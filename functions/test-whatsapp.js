const admin = require('firebase-admin');

// Initialize with application default credentials or specific config if needed
// Assuming this runs in an environment where it can auth (e.g. local with key or cloud shell)
// For local with no key, we might need service account key. 
// But let's try assuming the environment is set up or we can use the functions config if running via firebase shell?
// Actually simpler: use the existing functions context or just admin.initializeApp() if GOOGLE_APPLICATION_CREDENTIALS is execution.

// Since I cannot easily auth locally without a key file, I'll rely on the user to run this or use 'firebase functions:shell' methodology if possible.
// BUT, I can try to use a script that uses the 'firebase-admin' already installed in 'functions'.

const serviceAccount = require('./service-account.json'); // I'd need this.

// Alternative: Create a task via a temporary http function? No, that's complex.
// Let's just create a script and ask to run it with 'firebase functions:shell'? 
// No, 'firebase functions:shell' mimics the triggers.

// Let's write a script that mimics the trigger using the firebase-functions-test library?
// Or better: write a script that simply ADDS a document to firestore, relying on the deployed function to pick it up.
// For that I need auth.

admin.initializeApp();
const db = admin.firestore();

async function test() {
    console.log("Creating test task...");
    const ref = db.collection('tasks').doc();
    await ref.set({
        title: "Test WhatsApp Task",
        description: "Testing notification...",
        assignee: "Unassigned",
        projectId: "test-project",
        status: "backlog"
    });

    console.log("Task created. ID:", ref.id);

    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));

    console.log("Updating assignee to trigger notification...");
    await ref.update({
        assignee: "Federico",
        assigneePhone: process.env.TEST_PHONE || "15551642436", // The test number
        description: "Testing notification... UPDATED"
    });

    console.log("Update done. Check WhatsApp.");
}

test().catch(console.error);
