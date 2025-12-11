const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require('firebase-admin');
const OpenAI = require('openai');
const twilio = require('twilio');

admin.initializeApp();
const db = admin.firestore();

// NOTE: keys should be in environment variables for production
// functions.config().openai.key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'MISSING_KEY' });
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

setGlobalOptions({ maxInstances: 10 });

/**
 * 1. Process Quote
 * Triggered when a new 'task' is created with status 'backlog' and has a quoteUrl.
 */
exports.processQuote = onDocumentCreated("tasks/{taskId}", async (event) => {
    const snap = event.data;
    if (!snap) {
        return;
    }
    const data = snap.data();
    const context = { params: event.params };

    // Only process if it's the specific "Processing Quote..." task we created
    if (data.status !== 'backlog' || !data.quoteUrl || data.assignee !== 'AI_BOT') {
        return;
    }

    try {
        // 1. Analyze with OpenAI Vision
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a construction manager assistant. Extract tasks from the construction quote image. return a JSON array of objects with keys: title, description, deadline (estimate in YYYY-MM-DD), assignee (leave empty)."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract tasks from this quote." },
                        { type: "image_url", image_url: { url: data.quoteUrl } },
                    ],
                },
            ],
            max_tokens: 1000,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);
        const tasks = parsed.tasks || [];

        // 2. Create actual tasks from the AI response
        const batch = db.batch();

        tasks.forEach(task => {
            const newTaskRef = db.collection('tasks').doc();
            batch.set(newTaskRef, {
                ...task,
                projectId: data.projectId,
                status: 'backlog',
                createdAt: new Date(),
                originalQuoteId: context.params.taskId
            });
        });

        // 3. Mark the "Processing..." task as done or delete it
        // Let's update it to say "Quote Processed" and move to Done
        batch.update(snap.ref, {
            status: 'done',
            title: 'Quote Processed',
            description: `Extracted ${tasks.length} tasks from quote.`
        });

        await batch.commit();

    } catch (error) {
        console.error("AI Error:", error);
        await snap.ref.update({
            description: "Failed to process quote: " + error.message,
            status: 'backlog' // Keep in backlog so user sees error
        });
    }
});


/**
 * 2. Assign Task Notification
 * Triggered when a task assignee changes to a real person (phone number).
 */
exports.notifyAssignee = onDocumentUpdated("tasks/{taskId}", async (event) => {
    const change = event.data;
    if (!change) {
        return;
    }
    const newData = change.after.data();
    const oldData = change.before.data();

    // Check if assignee changed and is a valid phone number (simple check)
    // In real app, 'assignee' might be a separate field ID, here we assume it's the phone or name
    if (newData.assignee !== oldData.assignee && newData.assigneePhone) {

        let messageBody = `New Task Assigned: ${newData.title}\n${newData.description}`;
        if (newData.startDate) {
            messageBody += `\nStart Date: ${newData.startDate}`;
        }
        messageBody += `\nReply with 'DONE' and a photo when finished.`;

        try {
            await twilioClient.messages.create({
                body: messageBody,
                from: 'whatsapp:+14155238886', // Twilio Sandbox Number
                to: `whatsapp:${newData.assigneePhone}`
            });
            console.log("Sent WhatsApp to", newData.assigneePhone);
        } catch (e) {
            console.error("Twilio Error:", e);
        }
    }
});

/**
 * 3. WhatsApp Webhook
 * Responds to incoming messages
 */
exports.whatsappWebhook = onRequest(async (req, res) => {
    const { Body, From, NumMedia, MediaUrl0 } = req.body;

    // Simple logic: If user sends image, assume they are completing their specific assigned task.
    // In reality, we need to know WHICH task. simple MVP: find 'in-progress' task for this user.

    const phone = From.replace('whatsapp:', '');

    // Find task for this user
    const tasksSnap = await db.collection('tasks')
        .where('assigneePhone', '==', phone)
        .where('status', '==', 'in-progress')
        .limit(1)
        .get();

    if (tasksSnap.empty) {
        // No active task found
        // Maybe reply back saying "No active task found."
        // Using TwiML for reply
        res.set('Content-Type', 'text/xml');
        res.send(`
            <Response>
                <Message>You have no task in progress. Ask your manager.</Message>
            </Response>
        `);
        return;
    }

    const taskDoc = tasksSnap.docs[0];
    const updates = {};

    if (parseInt(NumMedia) > 0) {
        updates.status = 'done'; // Or 'review'
        updates.completionImage = MediaUrl0;
        updates.completionMessage = Body;
    } else {
        updates.log = admin.firestore.FieldValue.arrayUnion({ msg: Body, time: new Date() });
    }

    await taskDoc.ref.update(updates);

    res.set('Content-Type', 'text/xml');
    res.send(`
        <Response>
            <Message>Task updated! Good job, mate.</Message>
        </Response>
    `);
});

/**
 * 4. Scheduled Daily Task Reminder
 * Runs every day at 8:00 AM.
 * Checks for tasks starting today.
 */
exports.checkDailyTasks = onSchedule({ schedule: "every day 08:00" }, async (event) => {
    const today = new Date().toISOString().split('T')[0];
    console.log("Running daily check for:", today);

    try {
        const snapshot = await db.collection('tasks')
            .where('startDate', '==', today)
            .where('status', '!=', 'done')
            .get();

        if (snapshot.empty) {
            console.log('No tasks starting today.');
            return;
        }

        // Group by assigneePhone
        const tasksByPhone = {};
        snapshot.forEach(doc => {
            const task = doc.data();
            if (task.assigneePhone) {
                if (!tasksByPhone[task.assigneePhone]) {
                    tasksByPhone[task.assigneePhone] = [];
                }
                tasksByPhone[task.assigneePhone].push(task);
            }
        });

        // Send messages
        const promises = Object.keys(tasksByPhone).map(async (phone) => {
            const tasks = tasksByPhone[phone];
            const taskList = tasks.map(t => `- ${t.title}`).join('\n');
            const messageBody = `Good morning! You have ${tasks.length} tasks starting today:\n${taskList}\n\nReview them in the app.`;

            try {
                await twilioClient.messages.create({
                    body: messageBody,
                    from: 'whatsapp:+14155238886',
                    to: `whatsapp:${phone}`
                });
                return { phone, status: 'sent' };
            } catch (e) {
                console.error(`Failed to send to ${phone}`, e);
                return { phone, status: 'failed', error: e };
            }
        });

        await Promise.all(promises);
        console.log(`Sent reminders to ${Object.keys(tasksByPhone).length} assignees.`);

    } catch (error) {
        console.error("Error in scheduled task:", error);
    }
});
