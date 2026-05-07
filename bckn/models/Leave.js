const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    developerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    developerName: {
        type: String,
        required: true
    },
    developerEmail: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['sick', 'casual', 'earned', 'emergency', 'planned', 'other'],
        default: 'casual'
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending'
    },
    adminComments: {
        type: String,
        default: ''
    },
    appliedOn: {
        type: Date,
        default: Date.now
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    attachmentUrl: {
        type: String,
        default: ''
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
});

// Index for faster queries
leaveSchema.index({ developerId: 1, status: 1 });
leaveSchema.index({ startDate: -1 });

module.exports = mongoose.model('Leave', leaveSchema);