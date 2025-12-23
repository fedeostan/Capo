const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
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
 * @param {Array} parameters Positional parameters {{1}}, {{2}}...
 * @param {string} languageCode Language code (default 'pt_PT' for Portuguese)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendWhatsAppMessage = async (to, templateName, parameters = [], languageCode = 'pt_PT') => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.error("Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID");
        return { success: false, error: "Missing credentials" };
    }

    // Ensure 'to' number is just digits
    const cleanTo = to.replace(/\D/g, '');

    // Sanitize text for WhatsApp: remove newlines, tabs, and multiple spaces
    const sanitizeText = (text) => {
        return String(text)
            .replace(/[\n\r\t]/g, ' ')  // Replace newlines and tabs with space
            .replace(/\s{4,}/g, '   ')   // Replace 4+ spaces with 3 spaces
            .trim();
    };

    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

    try {
        let components = [];

        // Only add body component if there are parameters
        if (Array.isArray(parameters) && parameters.length > 0) {
            components = [{
                type: "body",
                parameters: parameters.map(param => ({
                    type: "text",
                    text: sanitizeText(param).substring(0, 1024)
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
                ...(components.length > 0 && { components })
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
            console.error("Payload sent:", JSON.stringify(payload));
            return { success: false, error: data.error?.message || "API error" };
        }

        console.log("WhatsApp template sent successfully:", data);
        return { success: true, messageId: data.messages?.[0]?.id };

    } catch (error) {
        console.error("WhatsApp Send Error:", error);
        return { success: false, error: error.message };
    }
};

// ============================================================================
// WhatsApp Template Helper Functions
// Ready to use once templates are approved in Meta Business Suite
// See: docs/whatsapp-templates.md for template specifications
// ============================================================================

/**
 * Send daily tasks summary (morning batch notification)
 * Template: daily_tasks_summary
 * @param {string} phone - Worker's phone number
 * @param {number} taskCount - Number of tasks for today
 * @param {string} taskList - Formatted list of tasks (e.g., "1. Task A   2. Task B")
 */
const sendDailyTasksSummary = async (phone, taskCount, taskList) => {
    return sendWhatsAppMessage(phone, 'daily_tasks_summary', [
        String(taskCount),
        taskList
    ]);
};

/**
 * Send task start prompt (ask worker to start or skip a task)
 * Template: task_start_prompt
 * @param {string} phone - Worker's phone number
 * @param {string} title - Task title
 * @param {string} description - Task description
 * @param {number} estimatedHours - Estimated hours to complete
 */
const sendTaskStartPrompt = async (phone, title, description, estimatedHours) => {
    return sendWhatsAppMessage(phone, 'task_start_prompt', [
        title,
        description || 'Sem descricao',
        String(estimatedHours || '?')
    ]);
};

/**
 * Send task completion check (ask worker if they finished)
 * Template: task_completion_check
 * @param {string} phone - Worker's phone number
 * @param {string} title - Task title
 */
const sendTaskCompletionCheck = async (phone, title) => {
    return sendWhatsAppMessage(phone, 'task_completion_check', [title]);
};

/**
 * Send task reminder (manual reminder from manager)
 * Template: task_reminder
 * @param {string} phone - Worker's phone number
 * @param {string} title - Task title
 * @param {string} description - Task description
 */
const sendTaskReminderMessage = async (phone, title, description) => {
    return sendWhatsAppMessage(phone, 'task_reminder', [
        title,
        description || 'Sem descricao'
    ]);
};

/**
 * Send task accepted confirmation
 * Template: task_accepted_confirmation
 * @param {string} phone - Worker's phone number
 * @param {string} title - Task title
 */
const sendTaskAcceptedConfirmation = async (phone, title) => {
    return sendWhatsAppMessage(phone, 'task_accepted_confirmation', [title]);
};

/**
 * Send all tasks complete message
 * Template: all_tasks_complete
 * @param {string} phone - Worker's phone number
 */
const sendAllTasksComplete = async (phone) => {
    return sendWhatsAppMessage(phone, 'all_tasks_complete', []);
};

/**
 * Handle WhatsApp button responses from workers
 * @param {string} phone - Worker's phone number (E.164 without +)
 * @param {string} buttonPayload - The button text/payload clicked
 */
const handleButtonResponse = async (phone, buttonPayload) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const contextRef = db.collection('whatsapp_context').doc(cleanPhone);
    const contextDoc = await contextRef.get();

    if (!contextDoc.exists) {
        console.log(`No context found for phone ${cleanPhone}`);
        return { handled: false, reason: 'no_context' };
    }

    const context = contextDoc.data();
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Normalize button payload (handle Portuguese text)
    const payload = buttonPayload.toLowerCase().trim();

    // --- Ver Primeira Tarefa ---
    if (payload === 'ver primeira tarefa') {
        if (!context.todaysTasks || context.todaysTasks.length === 0) {
            console.log(`No tasks in context for ${cleanPhone}`);
            return { handled: false, reason: 'no_tasks' };
        }

        const firstTask = context.todaysTasks[0];
        const taskDoc = await db.collection('tasks').doc(firstTask.taskId).get();

        if (!taskDoc.exists) {
            console.log(`Task ${firstTask.taskId} not found`);
            return { handled: false, reason: 'task_not_found' };
        }

        const task = taskDoc.data();

        // Update context
        await contextRef.update({
            currentTaskId: firstTask.taskId,
            currentProjectId: firstTask.projectId,
            currentTaskIndex: 0,
            awaitingResponse: 'task_start_prompt',
            lastMessageAt: now
        });

        // Send task start prompt
        await sendTaskStartPrompt(
            cleanPhone,
            task.title,
            task.description,
            task.estimatedHours
        );

        return { handled: true, action: 'sent_task_prompt' };
    }

    // --- Comecar Agora / Comecar ---
    if (payload === 'comecar agora' || payload === 'comecar') {
        if (!context.currentTaskId) {
            console.log(`No current task for ${cleanPhone}`);
            return { handled: false, reason: 'no_current_task' };
        }

        const taskRef = db.collection('tasks').doc(context.currentTaskId);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return { handled: false, reason: 'task_not_found' };
        }

        const task = taskDoc.data();

        // Update task to in-progress
        await taskRef.update({
            status: 'in-progress',
            acceptedAt: now
        });

        // Update context
        await contextRef.update({
            awaitingResponse: 'completion_check',
            lastMessageAt: now
        });

        // Send confirmation
        await sendTaskAcceptedConfirmation(cleanPhone, task.title);

        console.log(`Task ${context.currentTaskId} started by ${cleanPhone}`);
        return { handled: true, action: 'task_started' };
    }

    // --- Saltar (Skip) ---
    if (payload === 'saltar') {
        const nextIndex = (context.currentTaskIndex || 0) + 1;

        if (nextIndex >= context.todaysTasks.length) {
            // No more tasks
            await contextRef.update({
                currentTaskId: null,
                currentTaskIndex: nextIndex,
                awaitingResponse: null,
                lastMessageAt: now
            });
            await sendAllTasksComplete(cleanPhone);
            return { handled: true, action: 'all_tasks_complete' };
        }

        // Present next task
        const nextTask = context.todaysTasks[nextIndex];
        const taskDoc = await db.collection('tasks').doc(nextTask.taskId).get();

        if (!taskDoc.exists) {
            return { handled: false, reason: 'next_task_not_found' };
        }

        const task = taskDoc.data();

        await contextRef.update({
            currentTaskId: nextTask.taskId,
            currentProjectId: nextTask.projectId,
            currentTaskIndex: nextIndex,
            awaitingResponse: 'task_start_prompt',
            lastMessageAt: now
        });

        await sendTaskStartPrompt(
            cleanPhone,
            task.title,
            task.description,
            task.estimatedHours
        );

        return { handled: true, action: 'skipped_to_next' };
    }

    // --- Sim, Terminei (Task Done) ---
    if (payload === 'sim, terminei') {
        if (!context.currentTaskId) {
            return { handled: false, reason: 'no_current_task' };
        }

        const taskRef = db.collection('tasks').doc(context.currentTaskId);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return { handled: false, reason: 'task_not_found' };
        }

        // Mark task as done
        await taskRef.update({
            status: 'done',
            completedViaWhatsApp: true,
            completedAt: now
        });

        console.log(`Task ${context.currentTaskId} completed via WhatsApp by ${cleanPhone}`);

        // Move to next task
        const nextIndex = (context.currentTaskIndex || 0) + 1;

        if (nextIndex >= context.todaysTasks.length) {
            await contextRef.update({
                currentTaskId: null,
                currentTaskIndex: nextIndex,
                awaitingResponse: null,
                lastMessageAt: now
            });
            await sendAllTasksComplete(cleanPhone);
            return { handled: true, action: 'all_tasks_complete' };
        }

        // Present next task
        const nextTask = context.todaysTasks[nextIndex];
        const nextTaskDoc = await db.collection('tasks').doc(nextTask.taskId).get();

        if (!nextTaskDoc.exists) {
            return { handled: false, reason: 'next_task_not_found' };
        }

        const nextTaskData = nextTaskDoc.data();

        await contextRef.update({
            currentTaskId: nextTask.taskId,
            currentProjectId: nextTask.projectId,
            currentTaskIndex: nextIndex,
            awaitingResponse: 'task_start_prompt',
            lastMessageAt: now
        });

        await sendTaskStartPrompt(
            cleanPhone,
            nextTaskData.title,
            nextTaskData.description,
            nextTaskData.estimatedHours
        );

        return { handled: true, action: 'task_done_next_presented' };
    }

    // --- Ainda a Trabalhar (Still Working) ---
    if (payload === 'ainda a trabalhar') {
        await contextRef.update({
            lastMessageAt: now
        });
        // Just acknowledge, no template needed - they'll continue working
        console.log(`Worker ${cleanPhone} still working on task ${context.currentTaskId}`);
        return { handled: true, action: 'acknowledged_still_working' };
    }

    // --- OK (Acknowledge reminder) ---
    if (payload === 'ok') {
        await contextRef.update({
            lastMessageAt: now
        });
        console.log(`Worker ${cleanPhone} acknowledged reminder`);
        return { handled: true, action: 'acknowledged_reminder' };
    }

    console.log(`Unknown button payload from ${cleanPhone}: ${buttonPayload}`);
    return { handled: false, reason: 'unknown_payload' };
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
- dueDate: string (YYYY-MM-DD)
- estimatedHours: number (realistic hours needed for a small team to complete this task)`
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
                estimatedHours: task.estimatedHours || null,
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
 *
 * NOTE: Auto-notification has been disabled as part of the morning batch notification system.
 * Workers now receive their tasks at 7:30 AM Portugal time via checkDailyTasks.
 * Managers can manually send notifications using the "Notify Now" button in the app,
 * which triggers the sendTaskReminder callable function.
 */
exports.notifyAssignee = onDocumentUpdated("tasks/{taskId}", async (event) => {
    const change = event.data;
    if (!change) return;

    const newData = change.after.data();
    const oldData = change.before.data();

    // Check if assignee changed and is a valid phone number
    if (newData.assignee !== oldData.assignee && newData.assigneePhone) {
        // Log assignment change but do NOT send automatic notification
        // Notifications are now sent via:
        // 1. Morning batch (checkDailyTasks at 7:30 AM)
        // 2. Manual "Notify Now" button (sendTaskReminder callable)
        await logAIEvent(
            newData.projectId,
            event.params.taskId,
            'Task Assigned',
            `Task assigned to ${newData.assignee} (${newData.assigneePhone}). Use "Notify Now" in the app to send notification.`,
            'info'
        );

        console.log(`Task ${event.params.taskId} assigned to ${newData.assignee}. Auto-notification disabled - use manual notify or wait for morning batch.`);
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

    // Handle Incoming Messages from Meta WhatsApp Cloud API
    // Meta sends webhook events in a specific structure
    try {
        const body = req.body;

        // Meta webhook structure: body.entry[].changes[].value.messages[]
        if (body.object === 'whatsapp_business_account' && body.entry) {
            for (const entry of body.entry) {
                const changes = entry.changes || [];

                for (const change of changes) {
                    const value = change.value;

                    if (!value || !value.messages) continue;

                    for (const message of value.messages) {
                        const from = message.from; // Phone number
                        let buttonPayload = null;

                        // Handle button/quick reply responses
                        if (message.type === 'button' && message.button) {
                            // Template button response
                            buttonPayload = message.button.text || message.button.payload;
                        } else if (message.type === 'interactive' && message.interactive) {
                            // Interactive message response (quick reply)
                            if (message.interactive.type === 'button_reply') {
                                buttonPayload = message.interactive.button_reply.title;
                            }
                        }

                        if (buttonPayload && from) {
                            console.log(`Button response from ${from}: ${buttonPayload}`);
                            const result = await handleButtonResponse(from, buttonPayload);
                            console.log(`Button handler result:`, result);
                        } else if (message.type === 'text' && message.text) {
                            // Regular text message - log for now
                            console.log(`Text message from ${from}: ${message.text.body}`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error processing webhook:", error);
    }

    // Always respond 200 to Meta (they retry on failure)
    res.sendStatus(200);
});

/**
 * 4. Morning Batch Notification (7:30 AM Portugal Time)
 *
 * Sends a daily summary of all pending tasks to each worker via WhatsApp.
 * Creates/updates whatsapp_context for interactive button responses.
 */
exports.checkDailyTasks = onSchedule({
    schedule: "30 7 * * *",  // 7:30 AM every day (cron format)
    timeZone: "Europe/Lisbon"
}, async (event) => {
    const today = new Date().toISOString().split('T')[0];
    console.log("Running morning batch notification for:", today);

    try {
        // Query all backlog tasks that have an assignee
        const snapshot = await db.collection('tasks')
            .where('status', '==', 'backlog')
            .get();

        if (snapshot.empty) {
            console.log('No pending tasks found.');
            return;
        }

        // Group tasks by assigneePhone
        const tasksByPhone = {};
        snapshot.forEach(doc => {
            const task = doc.data();
            if (task.assigneePhone && task.assignee) {
                const phone = task.assigneePhone.replace(/\D/g, '');
                if (!tasksByPhone[phone]) {
                    tasksByPhone[phone] = {
                        assigneeName: task.assignee,
                        tasks: []
                    };
                }
                tasksByPhone[phone].tasks.push({
                    taskId: doc.id,
                    projectId: task.projectId,
                    title: task.title,
                    description: task.description || '',
                    dueDate: task.dueDate,
                    estimatedHours: task.estimatedHours || null
                });
            }
        });

        if (Object.keys(tasksByPhone).length === 0) {
            console.log('No tasks with assigned workers.');
            return;
        }

        // Process each worker
        const promises = Object.entries(tasksByPhone).map(async ([phone, data]) => {
            const { assigneeName, tasks } = data;

            try {
                // Sort tasks by dueDate (earliest first)
                tasks.sort((a, b) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return a.dueDate.localeCompare(b.dueDate);
                });

                // Build task list string (max 5 tasks to fit in template)
                const maxTasksToShow = Math.min(tasks.length, 5);
                const taskListLines = tasks.slice(0, maxTasksToShow).map((t, idx) => {
                    const dueStr = t.dueDate ? ` (${t.dueDate})` : '';
                    return `${idx + 1}. ${t.title}${dueStr}`;
                });

                if (tasks.length > maxTasksToShow) {
                    taskListLines.push(`... e mais ${tasks.length - maxTasksToShow} tarefas`);
                }

                const taskListStr = taskListLines.join(' | ');

                // Create/update whatsapp_context document
                const contextRef = db.collection('whatsapp_context').doc(phone);
                const todaysTasks = tasks.map((t, idx) => ({
                    taskId: t.taskId,
                    projectId: t.projectId,
                    title: t.title,
                    position: idx + 1
                }));

                await contextRef.set({
                    phone: phone,
                    assigneeName: assigneeName,
                    currentTaskId: null,
                    currentProjectId: null,
                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                    awaitingResponse: null,
                    todaysTasks: todaysTasks,
                    currentTaskIndex: 0
                }, { merge: true });

                // Send daily_tasks_summary template using helper function
                const result = await sendDailyTasksSummary(phone, tasks.length, taskListStr);

                if (result.success) {
                    // Update notifiedAt on all tasks for this worker
                    const batch = db.batch();
                    const now = admin.firestore.FieldValue.serverTimestamp();

                    tasks.forEach(t => {
                        const taskRef = db.collection('tasks').doc(t.taskId);
                        batch.update(taskRef, { notifiedAt: now });
                    });

                    await batch.commit();

                    console.log(`Sent daily summary to ${assigneeName} (${phone}): ${tasks.length} tasks`);
                    return { phone, status: 'sent', taskCount: tasks.length };
                } else {
                    console.error(`Failed to send daily summary to ${phone}: ${result.error}`);
                    return { phone, status: 'failed', error: result.error };
                }

            } catch (error) {
                console.error(`Error processing worker ${phone}:`, error);
                return { phone, status: 'error', error: error.message };
            }
        });

        const results = await Promise.all(promises);
        const sent = results.filter(r => r.status === 'sent').length;
        const failed = results.filter(r => r.status !== 'sent').length;

        console.log(`Morning batch complete: ${sent} sent, ${failed} failed`);

    } catch (error) {
        console.error("Error in morning batch notification:", error);
    }
});

/**
 * 5. Manual Task Reminder (Callable Function)
 *
 * Allows managers to manually send a reminder notification for a specific task.
 * Called from the React Native app via Firebase Functions SDK.
 *
 * @param {object} request.data - { taskId: string }
 * @returns {object} - { success: boolean, messageId?: string, error?: string }
 */
exports.sendTaskReminder = onCall(async (request) => {
    const { taskId } = request.data || {};

    if (!taskId) {
        throw new HttpsError('invalid-argument', 'taskId is required');
    }

    try {
        // Fetch task
        const taskDoc = await db.collection('tasks').doc(taskId).get();

        if (!taskDoc.exists) {
            throw new HttpsError('not-found', 'Task not found');
        }

        const task = taskDoc.data();

        if (!task.assigneePhone) {
            throw new HttpsError('failed-precondition', 'Task has no assigned worker with phone number');
        }

        // Send reminder using task_reminder template
        const result = await sendTaskReminderMessage(
            task.assigneePhone,
            task.title,
            task.description
        );

        if (!result.success) {
            throw new HttpsError('internal', result.error || 'Failed to send WhatsApp message');
        }

        // Update task metadata
        const now = admin.firestore.FieldValue.serverTimestamp();
        await taskDoc.ref.update({
            notifiedAt: now,
            reminderCount: admin.firestore.FieldValue.increment(1)
        });

        // Log the event
        await logAIEvent(
            task.projectId,
            taskId,
            'Manual Reminder Sent',
            `Reminder sent to ${task.assignee} (${task.assigneePhone})`,
            'info'
        );

        console.log(`Manual reminder sent for task ${taskId} to ${task.assigneePhone}`);

        return {
            success: true,
            messageId: result.messageId
        };

    } catch (error) {
        console.error(`Error sending manual reminder for task ${taskId}:`, error);

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError('internal', error.message);
    }
});
