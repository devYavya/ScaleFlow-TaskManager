require('dotenv').config();

const mongoose = require('mongoose');

const Task = require('./models/Task');

const migrateTasks = async () => {

    try {

        // =====================================================
        // CONNECT DATABASE
        // =====================================================

        await mongoose.connect(process.env.MONGODB_URI);

        console.log('✅ Connected to MongoDB\n');

        // =====================================================
        // GET ALL TASKS
        // =====================================================

        const tasks = await Task.find({});

        console.log(`📦 Found ${tasks.length} tasks\n`);

        let updatedCount = 0;

        // =====================================================
        // MIGRATE EACH TASK
        // =====================================================

        for (const task of tasks) {

            let updated = false;

            // ================= COMMENTS =================

            if (!task.comments) {
                task.comments = [];
                updated = true;
            }

            // ================= ATTACHMENTS =================

            if (!task.attachments) {
                task.attachments = [];
                updated = true;
            }

            // ================= CHECKLIST =================

            if (!task.checklist) {
                task.checklist = [];
                updated = true;
            }

            // ================= TIME LOGS =================

            if (!task.timeLogs) {
                task.timeLogs = [];
                updated = true;
            }

            // ================= ACTIVITY LOGS =================

            if (!task.activityLogs) {

                task.activityLogs = [{
                    action: 'TASK_MIGRATED',
                    performedBy: task.createdBy || null,
                    createdAt: new Date()
                }];

                updated = true;
            }

            // ================= WATCHERS =================

            if (!task.watchers) {
                task.watchers = [];
                updated = true;
            }

            // ================= BLOCKED TASKS =================

            if (!task.blockedBy) {
                task.blockedBy = [];
                updated = true;
            }

            // ================= TAGS =================

            if (!task.tags) {
                task.tags = [];
                updated = true;
            }

            // ================= STATUS =================

            if (!task.status) {
                task.status = 'todo';
                updated = true;
            }

            // Convert old statuses
            if (task.status === 'pending') {
                task.status = 'todo';
                updated = true;
            }

            // ================= PRIORITY =================

            if (!task.priority) {
                task.priority = 'medium';
                updated = true;
            }

            // ================= WORKFLOW =================

            if (!task.workflowStage) {
                task.workflowStage = 'planning';
                updated = true;
            }

            // ================= ESTIMATED HOURS =================

            if (task.estimatedHours === undefined) {
                task.estimatedHours = 0;
                updated = true;
            }

            // ================= ACTUAL HOURS =================

            if (task.actualHours === undefined) {
                task.actualHours = 0;
                updated = true;
            }

            // ================= SOFT DELETE =================

            if (task.isDeleted === undefined) {
                task.isDeleted = false;
                updated = true;
            }

            // ================= CLIENT APPROVAL =================

            if (!task.clientApproval) {

                task.clientApproval = {
                    approved: false
                };

                updated = true;
            }

            // ================= RECURRING =================

            if (task.isRecurring === undefined) {
                task.isRecurring = false;
                updated = true;
            }

            // ================= TASK NUMBER =================

            if (!task.taskNumber) {

                task.taskNumber =
                    `TSK-${1000 + updatedCount + 1}`;

                updated = true;
            }

            // ================= SAVE =================

            if (updated) {

                await task.save();

                updatedCount++;

                console.log(
                    `✅ Migrated Task: ${task.taskNumber} - ${task.title}`
                );
            }
        }

        // =====================================================
        // VERIFY SPECIFIC TASK
        // =====================================================

        const specificTask = await Task.findById(
            '69fb7b51b75983c60aa29508'
        );

        if (specificTask) {

            console.log('\n📋 Task Verification');

            console.log('--------------------------------');

            console.log(`Task Number: ${specificTask.taskNumber}`);

            console.log(`Title: ${specificTask.title}`);

            console.log(`Status: ${specificTask.status}`);

            console.log(`Workflow: ${specificTask.workflowStage}`);

            console.log(`Comments: ${specificTask.comments?.length || 0}`);

            console.log(`Checklist: ${specificTask.checklist?.length || 0}`);

            console.log(`Attachments: ${specificTask.attachments?.length || 0}`);

            console.log(`Tags: ${specificTask.tags?.length || 0}`);

            console.log(`Activity Logs: ${specificTask.activityLogs?.length || 0}`);
        }

        // =====================================================
        // SUMMARY
        // =====================================================

        console.log('\n====================================');

        console.log(`🎉 Migration Complete`);

        console.log(`📦 Total Tasks: ${tasks.length}`);

        console.log(`✅ Updated Tasks: ${updatedCount}`);

        console.log('====================================\n');

        // =====================================================
        // DISCONNECT
        // =====================================================

        await mongoose.disconnect();

        console.log('🔌 MongoDB disconnected');

    } catch (error) {

        console.error('\n❌ Migration Error');

        console.error(error.message);

        process.exit(1);
    }
};

migrateTasks();