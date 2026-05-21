// scripts/migrate-task-roles.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://scaleflowsoftware_db_user:LIv7mSH2YYUjTF4X@slf-taskmanagercluster0.fftkjtp.mongodb.net/SFS_TaskManager?retryWrites=true&w=majority';

// Simple schema definitions for migration
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    role: String
});

const taskSchema = new mongoose.Schema({
    taskNumber: String,
    title: String,
    createdBy: mongoose.Schema.Types.ObjectId,
    createdByRole: String,
    clientId: mongoose.Schema.Types.ObjectId
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

async function migrateTaskRoles() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log('Database:', mongoose.connection.name);

        // Find all tasks without createdByRole
        const tasksToMigrate = await Task.find({
            $or: [
                { createdByRole: { $exists: false } },
                { createdByRole: null },
                { createdByRole: '' }
            ]
        });

        console.log(`\n📊 Found ${tasksToMigrate.length} tasks needing migration\n`);

        let migrated = 0;
        let skipped = 0;
        let errors = 0;

        for (const task of tasksToMigrate) {
            try {
                let role = 'client'; // Default fallback
                
                // Try to find the user who created this task
                if (task.createdBy) {
                    const user = await User.findById(task.createdBy);
                    if (user && user.role) {
                        role = user.role;
                        console.log(`✅ Task ${task.taskNumber || task._id}: "${task.title.substring(0, 30)}..." → role = ${role} (from user ${user.email})`);
                    } else {
                        console.log(`⚠️ Task ${task.taskNumber || task._id}: User not found, using default role "client"`);
                    }
                } else {
                    console.log(`⚠️ Task ${task.taskNumber || task._id}: No createdBy, using default role "client"`);
                }
                
                // Update the task
                task.createdByRole = role;
                await task.save();
                migrated++;
                
            } catch (err) {
                errors++;
                console.error(`❌ Failed to migrate task ${task._id}:`, err.message);
            }
        }

        // Also check for tasks with invalid createdByRole values
        const invalidTasks = await Task.find({
            createdByRole: { $nin: ['admin', 'client', 'developer', 'client-team', null, undefined, ''] }
        });

        if (invalidTasks.length > 0) {
            console.log(`\n📊 Found ${invalidTasks.length} tasks with invalid roles`);
            
            for (const task of invalidTasks) {
                try {
                    let role = 'client';
                    if (task.createdBy) {
                        const user = await User.findById(task.createdBy);
                        if (user && user.role) {
                            role = user.role;
                        }
                    }
                    task.createdByRole = role;
                    await task.save();
                    migrated++;
                    console.log(`✅ Fixed invalid role for task ${task.taskNumber || task._id}: now ${role}`);
                } catch (err) {
                    errors++;
                }
            }
        }

        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Tasks migrated:     ${migrated}`);
        console.log(`Tasks skipped:      ${skipped}`);
        console.log(`Errors:             ${errors}`);
        console.log('='.repeat(60));

        // Final verification
        const remaining = await Task.countDocuments({
            $or: [
                { createdByRole: { $exists: false } },
                { createdByRole: null },
                { createdByRole: '' }
            ]
        });

        if (remaining === 0) {
            console.log('\n✅ All tasks have been successfully migrated!');
            console.log('💡 You can now set createdByRole back to required: true in your schema');
        } else {
            console.log(`\n⚠️ ${remaining} tasks still need migration`);
        }

        // Show sample of migrated tasks
        const sampleTasks = await Task.find({ createdByRole: { $exists: true } })
            .limit(5)
            .populate('createdBy', 'name email role');
        
        if (sampleTasks.length > 0) {
            console.log('\n📋 Sample of migrated tasks:');
            sampleTasks.forEach(task => {
                console.log(`   - ${task.taskNumber || task._id}: createdByRole = ${task.createdByRole} (${task.createdBy?.email || 'unknown'})`);
            });
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the migration
migrateTaskRoles();