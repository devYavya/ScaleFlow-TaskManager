const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6
    },
    role: {
        type: String,
        enum: ['admin', 'client', 'developer', 'client-team'],
        required: true
    },
    company: {
        type: String,
        default: ''
    },
    // For client-team members: which client they belong to
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // Track who created this team member
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Optional: limits for client (max team members)
    maxTeamMembers: {
        type: Number,
        default: 2  // Clients can have up to 2 team members by default
    },
    resetToken: String,
    resetTokenExpiry: Date,
    lastLogin: {
        type: Date,
        default: null
    },
    profilePicture: {
        type: String,
        default: ''
    },
    phoneNumber: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ clientId: 1 });
userSchema.index({ company: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Virtual: Get all team members for a client
userSchema.virtual('teamMembers', {
    ref: 'User',
    localField: '_id',
    foreignField: 'clientId',
    justOne: false,
    match: { role: 'client-team', isActive: true }
});

// Virtual: Get client for a team member
userSchema.virtual('client', {
    ref: 'User',
    localField: 'clientId',
    foreignField: '_id',
    justOne: true
});

// Method: Check if client can add more team members
userSchema.methods.canAddTeamMember = async function() {
    if (this.role !== 'client') return false;
    const teamMemberCount = await mongoose.model('User').countDocuments({
        clientId: this._id,
        role: 'client-team',
        isActive: true
    });
    return teamMemberCount < (this.maxTeamMembers || 2);
};

// Method: Get remaining team member slots
userSchema.methods.getRemainingTeamSlots = async function() {
    if (this.role !== 'client') return 0;
    const teamMemberCount = await mongoose.model('User').countDocuments({
        clientId: this._id,
        role: 'client-team',
        isActive: true
    });
    return Math.max(0, (this.maxTeamMembers || 2) - teamMemberCount);
};

// Static: Find clients by company
userSchema.statics.findByCompany = function(company) {
    return this.find({ company, role: 'client', isActive: true });
};

// Static: Find team members by client
userSchema.statics.findTeamMembersByClient = function(clientId) {
    return this.find({ clientId, role: 'client-team', isActive: true })
        .select('-password -resetToken -resetTokenExpiry');
};

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);