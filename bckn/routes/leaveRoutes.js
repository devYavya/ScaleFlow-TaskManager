const express = require('express');
const router = express.Router();
const Leave = require('../models/leave');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { sendLeaveRequestEmail, sendLeaveApprovalEmail } = require('../utils/emailService');

// ======================================================
// APPLY FOR LEAVE (Developer)
// ======================================================

router.post('/apply', authenticate, async (req, res, next) => {
    try {
        const { startDate, endDate, reason, type } = req.body;
        
        if (req.user.role !== 'developer') {
            return res.status(403).json({ error: 'Only developers can apply for leave' });
        }
        
        // Check for overlapping leave requests
        const existingLeave = await Leave.findOne({
            developerId: req.user._id,
            status: { $in: ['pending', 'approved'] },
            $or: [
                { startDate: { $lte: new Date(endDate), $gte: new Date(startDate) } },
                { endDate: { $lte: new Date(endDate), $gte: new Date(startDate) } }
            ]
        });
        
        if (existingLeave) {
            return res.status(400).json({ error: 'You already have a leave request for this period' });
        }
        
        const leave = new Leave({
            developerId: req.user._id,
            developerName: req.user.name,
            developerEmail: req.user.email,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            type: type || 'casual',
            status: 'pending',
            appliedOn: new Date()
        });
        
        await leave.save();
        
        // Send email notification to admin
        await sendLeaveRequestEmail(leave, req.user);
        
        res.status(201).json({
            success: true,
            message: 'Leave request submitted successfully. Admin will be notified.',
            leave
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET MY LEAVES (Developer)
// ======================================================

router.get('/my-leaves', authenticate, async (req, res, next) => {
    try {
        let query = { developerId: req.user._id, isDeleted: false };
        
        if (req.query.status) query.status = req.query.status;
        
        const leaves = await Leave.find(query).sort({ appliedOn: -1 });
        
        res.json({
            success: true,
            count: leaves.length,
            leaves
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET ALL LEAVE REQUESTS (Admin)
// ======================================================

router.get('/all', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        let query = { isDeleted: false };
        
        if (req.query.status) query.status = req.query.status;
        if (req.query.developerId) query.developerId = req.query.developerId;
        
        const leaves = await Leave.find(query)
            .populate('developerId', 'name email')
            .populate('approvedBy', 'name email')
            .sort({ appliedOn: -1 });
        
        // Group by status
        const grouped = {
            pending: leaves.filter(l => l.status === 'pending'),
            approved: leaves.filter(l => l.status === 'approved'),
            rejected: leaves.filter(l => l.status === 'rejected')
        };
        
        res.json({
            success: true,
            total: leaves.length,
            leaves: grouped
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// APPROVE LEAVE REQUEST (Admin)
// ======================================================

router.put('/:id/approve', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { adminComments } = req.body;
        const leave = await Leave.findById(req.params.id);
        
        if (!leave) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        
        leave.status = 'approved';
        leave.adminComments = adminComments || '';
        leave.approvedBy = req.user._id;
        leave.approvedAt = new Date();
        
        await leave.save();
        
        // Send approval email to developer
        const developer = await User.findById(leave.developerId);
        if (developer) {
            await sendLeaveApprovalEmail(leave, developer, 'approved', req.user.name);
        }
        
        res.json({
            success: true,
            message: 'Leave request approved successfully',
            leave
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// REJECT LEAVE REQUEST (Admin)
// ======================================================

router.put('/:id/reject', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { adminComments } = req.body;
        const leave = await Leave.findById(req.params.id);
        
        if (!leave) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        
        leave.status = 'rejected';
        leave.adminComments = adminComments || '';
        leave.approvedBy = req.user._id;
        leave.approvedAt = new Date();
        
        await leave.save();
        
        // Send rejection email to developer
        const developer = await User.findById(leave.developerId);
        if (developer) {
            await sendLeaveApprovalEmail(leave, developer, 'rejected', req.user.name);
        }
        
        res.json({
            success: true,
            message: 'Leave request rejected',
            leave
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// CANCEL LEAVE REQUEST (Developer)
// ======================================================

router.put('/:id/cancel', authenticate, async (req, res, next) => {
    try {
        const leave = await Leave.findById(req.params.id);
        
        if (!leave) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        
        if (leave.developerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only cancel your own leave requests' });
        }
        
        if (leave.status !== 'pending') {
            return res.status(400).json({ error: 'Can only cancel pending leave requests' });
        }
        
        leave.status = 'cancelled';
        await leave.save();
        
        res.json({
            success: true,
            message: 'Leave request cancelled',
            leave
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET LEAVE STATISTICS (Admin)
// ======================================================

router.get('/stats', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const pending = await Leave.countDocuments({ status: 'pending', isDeleted: false });
        const approved = await Leave.countDocuments({ status: 'approved', isDeleted: false });
        const rejected = await Leave.countDocuments({ status: 'rejected', isDeleted: false });
        
        // Get leave counts by developer
        const byDeveloper = await Leave.aggregate([
            { $match: { isDeleted: false, status: 'approved' } },
            { $group: { _id: '$developerId', count: { $sum: 1 } } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'developer' } },
            { $unwind: '$developer' },
            { $project: { name: '$developer.name', email: '$developer.email', leaveCount: '$count' } }
        ]);
        
        res.json({
            success: true,
            stats: { pending, approved, rejected },
            byDeveloper
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
