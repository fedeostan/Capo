const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require('firebase-admin');
const OpenAI = require('openai');
const twilio = require('twilio');

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

// Lazy init helpers to prevent cold start crashes
const getOpenAI = () => {
    if (!process.env.OPENAI_API_KEY) {
        console.warn("Missing OPENAI_API_KEY");
        return null;
    }
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

const getTwilio = () => {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
        console.warn("Missing TWILIO_SID or TWILIO_TOKEN");
        return null;
    }
    try {
        return twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    } catch (e) {
        console.error("Twilio Init Error:", e);
        return null;
    }
};

const logAIEvent = async (projectId, taskId, step, detail, type = 'info') => {
    try {
        await db.collection('ai_logs').add({
            projectId,
            taskId, // Optional, can be null
            step,
            detail: typeof detail === 'object' ? JSON.stringify(detail) : detail,
            type, // 'info', 'success', 'error', 'warning'
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("Failed to write AI log:", e);
    }
};

/**
 * 1. Process Quote
 */
exports.processQuote = onDocumentCreated({
    document: "tasks/{taskId}",
    timeoutSeconds: 300,
    memory: '1GiB'
}, async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const context = { params: event.params };

    if (data.status !== 'backlog' || !data.quoteUrl || data.assignee !== 'AI_BOT') {
        return;
    }

    const openai = getOpenAI();
    if (!openai) {
        await snap.ref.update({ description: "System Error: Missing OpenAI Key", status: 'backlog' });
        return;
    }

    try {
        await logAIEvent(data.projectId, context.params.taskId, 'Process Started', 'Analyzing quote for task extraction...');

        // Project Context Dates
        const projectStart = data.projectStartDate || new Date().toISOString().split('T')[0];
        const projectEnd = data.projectDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await logAIEvent(data.projectId, context.params.taskId, 'Context Loaded', `Project Start: ${projectStart}, Deadline: ${projectEnd}`);

        // ... AI Logic

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an Expert Construction Project Manager & Scheduler for a small construction company.
Your goal is to extract actionable tasks from the quote and create a realistic project schedule.

The project starts on ${projectStart} and must end by ${projectEnd}.

## Instructions
1. **Extract Tasks**: Identify every distinct construction activity in the quote.
2. **Titles**: Must be VERY clear, SHORT, and start with an ACTION VERB (e.g., "Install Drywall", "Paint Living Room"). Avoid vague titles.
3. **Descriptions**: Detailed and 100% focused on construction. Include specific location, products/materials mentioned, and dimensions.
4. **Risk Control**: Do NOT hallucinate. Only include items explicitly present or clearly implied by the quote.

## Scheduling Logic
- You are the scheduler. Determine the logical order of operations (e.g., Drywall BEFORE Paint).
- Estimate realistic duration for each task (days) for a small team.
- Assign a 'startDate' and 'dueDate' for EVERY task.
- Tasks can run in parallel if logical, but assume limited manpower.
- CRITICAL: All dates must be STRICTLY within ${projectStart} and ${projectEnd}.

## Output Format
Return a JSON object with a key "tasks" containing an array of objects. Each object must have:
- title: string
- description: string (summary of the work)
- steps: array of strings (granular sub-steps for the worker to follow)
- startDate: string (YYYY-MM-DD)
- dueDate: string (YYYY-MM-DD)`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this specific quote, extract all tasks, and create a schedule." },
                        { type: "image_url", image_url: { url: data.quoteUrl } },
                    ],
                },
            ],
            max_tokens: 2500,
            response_format: { type: "json_object" }
        });

        await logAIEvent(data.projectId, context.params.taskId, 'AI Response', 'Received response from OpenAI. Parsing...');

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);
        const tasks = parsed.tasks || [];

        await logAIEvent(data.projectId, context.params.taskId, 'Extraction Complete', `Extracted ${tasks.length} tasks.`);

        const batch = db.batch();
        tasks.forEach(task => {
            const newTaskRef = db.collection('tasks').doc();

            // Format description to include steps for clarity in the UI
            let finalDescription = task.description || "";
            if (task.steps && Array.isArray(task.steps) && task.steps.length > 0) {
                finalDescription += "\n\nSteps:\n" + task.steps.map(s => `- ${s}`).join("\n");
            }

            batch.set(newTaskRef, {
                title: task.title,
                description: finalDescription,
                startDate: task.startDate,
                dueDate: task.dueDate,
                projectId: data.projectId,
                status: 'backlog',
                isNew: true,
                createdAt: new Date(),
                originalQuoteId: context.params.taskId
            });
        });

        batch.update(snap.ref, {
            status: 'done',
            title: 'Quote Processed',
            description: `Extracted ${tasks.length} tasks from quote.`
        });

        await logAIEvent(data.projectId, context.params.taskId, 'Process Complete', 'All tasks created successfully.', 'success');

        await batch.commit();

    } catch (error) {
        console.error("AI Error:", error);
        await snap.ref.update({
            description: "Failed to process quote: " + error.message,
            status: 'error'
        });
        await logAIEvent(data.projectId, context.params.taskId, 'Error', error.message, 'error');
    }
});


/**
 * 2. Assign Task Notification
 */
exports.notifyAssignee = onDocumentUpdated("tasks/{taskId}", async (event) => {
    const change = event.data;
    if (!change) return;

    const newData = change.after.data();
    const oldData = change.before.data();

    // Check if assignee changed and is a valid phone number
    if (newData.assignee !== oldData.assignee && newData.assigneePhone) {
        const twilioClient = getTwilio();
        if (!twilioClient) return;

        let messageBody = `New Task Assigned: ${newData.title}\n${newData.description}`;
        if (newData.startDate) {
            messageBody += `\nStart Date: ${newData.startDate}`;
        }
        messageBody += `\nReply with 'DONE' and a photo when finished.`;

        try {
            // User requested IMMEDIATE notification for testing.
            await twilioClient.messages.create({
                body: messageBody,
                from: process.env.TWILIO_FROM || 'whatsapp:+14155238886',
                to: `whatsapp:${newData.assigneePhone}`
            });
            console.log("Sent WhatsApp to", newData.assigneePhone, "from", process.env.TWILIO_FROM);
            await logAIEvent(newData.projectId, event.params.taskId, 'Notification Sent', `WhatsApp sent to ${newData.assignee}.`, 'success');
            // console.log("Skipping immediate WhatsApp notification for", newData.assigneePhone, "(Scheduled for start date)");
        } catch (e) {
            console.error("Twilio Error:", e);
        }
    }
});

/**
 * 3. WhatsApp Webhook
 */
exports.whatsappWebhook = onRequest(async (req, res) => {
    const { Body, From, NumMedia, MediaUrl0 } = req.body;
    const phone = From ? From.replace('whatsapp:', '') : '';

    const tasksSnap = await db.collection('tasks')
        .where('assigneePhone', '==', phone)
        .where('status', '==', 'in-progress')
        .limit(1)
        .get();

    if (tasksSnap.empty) {
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
        updates.status = 'done';
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

        const twilioClient = getTwilio();
        if (!twilioClient) {
            console.error("Skipping reminders, no Twilio client.");
            return;
        }

        const promises = Object.keys(tasksByPhone).map(async (phone) => {
            const tasks = tasksByPhone[phone];
            const taskList = tasks.map(t => `- ${t.title}`).join('\n');
            const messageBody = `Good morning! You have ${tasks.length} tasks starting today:\n${taskList}\n\nReview them in the app.`;

            try {
                await twilioClient.messages.create({
                    body: messageBody,
                    from: process.env.TWILIO_FROM || 'whatsapp:+14155238886',
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
