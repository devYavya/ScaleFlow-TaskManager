const mongoose = require('mongoose');

// Comment Schema
const commentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    author: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['admin', 'client', 'developer'], required: true },
    createdAt: { type: Date, default: Date.now }
});

// Checklist Schema
const checklistItemSchema = new mongoose.Schema({
    text: { type: String, required: true },
    completed: { type: Boolean, default: false }
});

// Activity Log Schema
const activityLogSchema = new mongoose.Schema({
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
});

// Task Schema
const taskSchema = new mongoose.Schema({
    taskNumber: { type: String, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
        type: String,
        enum: ['todo', 'in-progress', 'in-review', 'blocked', 'completed', 'pending'],
        default: 'todo'
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    workflowStage: { type: String, enum: ['planning', 'development', 'testing', 'review', 'deployment'], default: 'planning' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date },
    dueDate: { type: Date },
    estimatedHours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    tags: [{ type: String }],
    checklist: [checklistItemSchema],
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
    attachments: [{
        filename: String,
        url: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now }
    }],
    activityLogs: [activityLogSchema],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    milestone: { type: String },
    sprint: { type: String },
    blockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    clientApproval: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        comments: String
    },
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: { type: String },
    timeLogs: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        hours: Number,
        date: { type: Date, default: Date.now },
        description: String
    }]
}, { timestamps: true });

// Auto-generate task number before saving
taskSchema.pre('save', async function(next) {
    if (!this.taskNumber) {
        const count = await mongoose.model('Task').countDocuments();
        this.taskNumber = `TSK-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Indexes
taskSchema.index({ status: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ clientId: 1 });
taskSchema.index({ taskNumber: 1 });
taskSchema.index({ createdAt: -1 });

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
module.exports = Task;
