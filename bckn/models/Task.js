const mongoose = require('mongoose');

// Comment Schema
const commentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    author: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['admin', 'client', 'developer', 'client-team'], required: true },
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
    performedByRole: { type: String, enum: ['admin', 'client', 'developer', 'client-team'] },
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
    
    // User relationships
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    createdByRole: { 
        type: String, 
        enum: ['admin', 'client', 'developer', 'client-team'],
        required: false,
        immutable: true
    },
    assignedTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null
    },
    clientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    
    // For client-team members: track which team member created this
    teamMemberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    
    // Dates
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date },
    
    // Time tracking
    estimatedHours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    timeLogs: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        hours: Number,
        date: { type: Date, default: Date.now },
        description: String
    }],
    
    // Metadata
    tags: [{ type: String }],
    milestone: { type: String },
    sprint: { type: String },
    
    // Checklist and comments
    checklist: [checklistItemSchema],
    comments: [commentSchema],
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Attachments
    attachments: [{
        filename: String,
        url: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedByName: { type: String },
        uploadedAt: { type: Date, default: Date.now }
    }],
    
    // Activity logs
    activityLogs: [activityLogSchema],
    
    // Blocking
    blockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    
    // Client approval workflow
    clientApproval: {
        status: { type: String, enum: ['pending', 'approved', 'rejected', 'revision-requested'], default: 'pending' },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedByName: { type: String },
        approvedAt: { type: Date },
        comments: String,
        revisionRequestedAt: { type: Date },
        revisionComments: { type: String }
    },
    
    // Recurring tasks
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: { type: String },
    parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    
    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedReason: { type: String },
    
    // Additional fields
    source: {
        type: String,
        enum: ['client-portal', 'team-member-portal', 'admin-portal', 'api'],
        default: 'client-portal'
    },
    priorityScore: { type: Number, default: 0 } // For sorting/priority calculations
    
}, { timestamps: true });

// Auto-generate task number before saving
taskSchema.pre('save', async function(next) {
    if (!this.taskNumber) {
        const count = await mongoose.model('Task').countDocuments();
        this.taskNumber = `TSK-${String(count + 1).padStart(4, '0')}`;
    }
    
    // Set createdByRole if not provided
    if (!this.createdByRole && this.createdBy) {
        const User = mongoose.model('User');
        const user = await User.findById(this.createdBy);
        if (user) {
            this.createdByRole = user.role;
        }
    }
    
    next();
});

// Method to check if user can view this task
taskSchema.methods.canView = function(userId, userRole, userClientId) {
    if (userRole === 'admin') return true;
    if (userRole === 'developer' && this.assignedTo?.toString() === userId.toString()) return true;
    if (userRole === 'client' && this.clientId?.toString() === userId.toString()) return true;
    if (userRole === 'client-team' && this.clientId?.toString() === userClientId?.toString()) return true;
    if (this.createdBy?.toString() === userId.toString()) return true;
    return false;
};

// Method to check if user can edit this task
taskSchema.methods.canEdit = function(userId, userRole) {
    if (userRole === 'admin') return true;
    if (userRole === 'developer' && this.assignedTo?.toString() === userId.toString()) return true;
    if (userRole === 'client' && this.createdBy?.toString() === userId.toString()) return true;
    if (userRole === 'client-team' && this.createdBy?.toString() === userId.toString()) return true;
    return false;
};

// Static method to get tasks for a client (including team member tasks)
taskSchema.statics.getClientTasks = async function(clientId) {
    return this.find({
        clientId: clientId,
        isDeleted: false
    })
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email')
    .populate('teamMemberId', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get tasks for a team member
taskSchema.statics.getTeamMemberTasks = async function(teamMemberId, clientId) {
    return this.find({
        createdBy: teamMemberId,
        clientId: clientId,
        isDeleted: false
    })
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 });
};

// Virtual: Get task creator type
taskSchema.virtual('creatorType').get(function() {
    if (this.createdByRole === 'client') return 'Client';
    if (this.createdByRole === 'client-team') return 'Team Member';
    if (this.createdByRole === 'admin') return 'Admin';
    return 'Unknown';
});

// Virtual: Get time to completion in days
taskSchema.virtual('timeToCompletion').get(function() {
    if (!this.completedAt || !this.createdAt) return null;
    const diffTime = Math.abs(this.completedAt - this.createdAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
taskSchema.index({ status: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ clientId: 1 });
taskSchema.index({ teamMemberId: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ createdByRole: 1 });
taskSchema.index({ taskNumber: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ clientApproval: 1 });
taskSchema.index({ isDeleted: 1 });

// Compound indexes for common queries
taskSchema.index({ clientId: 1, status: 1 });
taskSchema.index({ clientId: 1, createdAt: -1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ createdBy: 1, clientId: 1 });

// Ensure virtuals are included in JSON output
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
module.exports = Task;