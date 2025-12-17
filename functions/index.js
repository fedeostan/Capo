const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require('firebase-admin');
const OpenAI = require('openai');

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

// Lazy init helpers
const getOpenAI = () => {
    if (!process.env.OPENAI_API_KEY) {
        console.warn("Missing OPENAI_API_KEY");
        return null;
    }
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

/**
 * Helper to send WhatsApp messages using Meta Cloud API
 * @param {string} to Phone number in E.164 format (no +)
 * @param {string} templateName Name of the template to send
 * @param {Object|Array} parameters Parameters for the template. 
 *        - If Array: Positional parameters {{1}}, {{2}}...
 *        - If Object: Named parameters (key = variable name, val = value)
 * @param {string} languageCode Language code (default 'en')
 */
const sendWhatsAppMessage = async (to, templateName, parameters = {}, languageCode = 'en') => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.error("Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID");
        return false;
    }

    // Ensure 'to' number is just digits
    const cleanTo = to.replace(/\D/g, '');

    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

    try {
        let components = [];

        if (Array.isArray(parameters)) {
            // Positional Parameters
            components = [{
                type: "body",
                parameters: parameters.map(param => ({
                    type: "text",
                    text: String(param).substring(0, 1024)
                }))
            }];
        } else {
            // Named Parameters (New logic for task_assignment)
            // Function requires explicit mapping if API changes, but Meta Cloud API usually 
            // takes an array of parameter objects. 
            // However, "parameter_format": "NAMED" in the API response usually implies 
            // used in Marketing conversations, but standard Cloud API messages 
            // usually behave via components order OR named params if supported.
            //
            // CORRECT API USAGE FOR "NAMED" PRE-DEFINED TEMPLATES:
            // Actually, official Cloud API documentation *mostly* uses positional params even for named variables
            // based on the order they appear in the body.
            // BUT, if the user explicitly created it with named params, we might need to send them as
            // "cards" or specific components if it's a rich template.
            //
            // Let's look at the API Response the user got:
            // "parameter_format": "NAMED", "components": [{"type":"BODY" ... "example":{"body_text_named_params": ...}}]

            // NOTE: Cloud API textual templates mostly map named params to positions in order of appearance.
            // But let's try to map keys to values if we can, or just fall back to strict order.
            // The template has: {{task_title}} and {{task_description}}.
            // We should pass them in that order.

            // Let's stick to the Array approach but allow the caller to pass an object 
            // and we convert to array based on known keys if needed, OR just trust the caller passes Array.
            // Wait, I will just update the CALLER to pass the array in connection with the template.
            // BUT I will update the defaulting to 'en'.

            components = [{
                type: "body",
                parameters: Object.keys(parameters).map(key => ({
                    type: "text",
                    parameter_name: key, // Some variants support this
                    text: String(parameters[key]).substring(0, 1024)
                }))
            }];

            // Revert: Standard Cloud API for text templates uses positional params.
            // Even if "NAMED" is in the management API, sending usually requires ordered params.
            // Docs say: "For text-based templates... parameters are positional."
            // However, let's support the passed structure.
            // If I look closely at the error: "template name ... does not exist in en_US".
            // So fixing the language is the main priority.
            // The user SAID "named parameters", so I will update `notifyAssignee` to send an ARRAY in the correct order.

            // Actually, I'll keep the robust Array logic and just update language default.
            components = [{
                type: "body",
                parameters: parameters.map(param => ({
                    type: "text",
                    text: String(param).substring(0, 1024)
                }))
            }];
        }

        const payload = {
            messaging_product: "whatsapp",
            to: cleanTo,
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: languageCode
                },
                components: components
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("WhatsApp API Error Response:", JSON.stringify(data));
            return false;
        }

        console.log("WhatsApp template sent successfully:", data);
        return true;

    } catch (error) {
        console.error("WhatsApp Send Error:", error);
        return false;
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

        // Use Template: task_assignment
        // Variables: {{task_title}}, {{task_description}}
        // Standard Cloud API maps these via order or explicitly key-val if we implemented that.
        // Given we are sending simpler logic, we send Array, verifying order.
        const templateName = 'task_assignment';
        const params = [
            newData.title,
            newData.description || 'No description provided.'
        ];

        // Ensure we send 'en' as language code
        const success = await sendWhatsAppMessage(newData.assigneePhone, templateName, params, 'en');

        if (success) {
            await logAIEvent(newData.projectId, event.params.taskId, 'Notification Sent', `WhatsApp template sent to ${newData.assignee}.`, 'success');
        } else {
            await logAIEvent(newData.projectId, event.params.taskId, 'Notification Failed', `Failed to send WhatsApp template to ${newData.assignee}.`, 'error');
        }
    }
});

/**
 * 3. WhatsApp Webhook
 */
exports.whatsappWebhook = onRequest(async (req, res) => {
    // Basic verification for Facebook Webhook verification challenge
    // (This is required for the webhook to be verified by Meta)
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === 'MY_VERIFY_TOKEN') { // Ideally use a secret env var
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
            return;
        } else {
            res.sendStatus(403);
            return;
        }
    }

    // Handle Incoming Messages
    // Note: The structure of incoming messages from Graph API is different from Twilio
    // For now, let's just log the body to understand the structure if we need to implement 2-way chat later.
    // The previous implementation was Twilio specific structure (Body, From, NumMedia, etc)

    console.log("Incoming Webhook Payload:", JSON.stringify(req.body, null, 2));

    res.sendStatus(200);
});

/**
 * 4. Scheduled Daily Task Reminder
 */
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

        const promises = Object.keys(tasksByPhone).map(async (phone) => {
            const tasks = tasksByPhone[phone];
            // Cannot send free text. We need a "daily_digest" template.
            // For now, let's skip sending or use hello_world to notify there are tasks.
            // Using hello_world requires no params.

            // TODO: Create a daily_digest template
            // const success = await sendWhatsAppMessage(phone, "hello_world", []);

            console.log(`Skipping daily reminder for ${phone} - No Template Available`);
            return { phone, status: 'skipped' };
        });

        await Promise.all(promises);
        console.log(`Processed reminders for ${Object.keys(tasksByPhone).length} assignees.`);

    } catch (error) {
        console.error("Error in scheduled task:", error);
    }
});
