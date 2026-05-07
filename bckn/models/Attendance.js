const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    developerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'late', 'half-day', 'holiday', 'weekoff'],
        default: 'present'
    },
    checkIn: {
        type: String,
        default: null
    },
    checkOut: {
        type: String,
        default: null
    },
    hoursWorked: {
        type: Number,
        default: 0
    },
    hadWork: {
        type: Boolean,
        default: true
    },
    workDescription: {
        type: String,
        default: ''
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to prevent duplicate entries per developer per day
attendanceSchema.index({ developerId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
