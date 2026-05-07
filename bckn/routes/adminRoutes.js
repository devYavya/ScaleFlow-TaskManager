const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Task = require('../models/task');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validation');
const { sendInvitationEmail } = require('../utils/emailService');
const crypto = require('crypto');

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// @route   GET /api/admin/users
// @desc    Get all users (clients and developers)
router.get('/users', async (req, res, next) => {
    try {
        const { role, isActive, search } = req.query;
        
        let query = {};
        if (role) query.role = role;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const users = await User.find(query)
            .select('-password -resetToken -resetTokenExpiry')
            .sort({ createdAt: -1 });
        
        // Group users by role for easier frontend consumption
        const grouped = {
            admins: users.filter(u => u.role === 'admin'),
            clients: users.filter(u => u.role === 'client'),
            developers: users.filter(u => u.role === 'developer'),
            all: users
        };
        
        res.json({
            count: users.length,
            users: grouped
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/users/:id
// @desc    Get single user details
router.get('/users/:id', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -resetToken -resetTokenExpiry');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/users
// @desc    Create new user (client or developer) & send invitation
router.post('/users', validate.createUserByAdmin, async (req, res, next) => {
    try {
        const { name, email, role, company } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }
        
        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        
        const user = new User({
            name,
            email,
            password: tempPassword,
            role,
            company: company || '',
            isActive: true
        });
        
        await user.save();
        
        // Send invitation email with password reset link
        await sendInvitationEmail(email, name, tempPassword, role);
        
        res.status(201).json({
            success: true,
            message: `User created and invitation sent to ${email}`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
                createdAt: user.createdAt
            },
            tempPassword // Only show this once for testing, not in production!
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (deactivate, change role, etc.)
router.put('/users/:id', async (req, res, next) => {
    try {
        const { name, role, company, isActive } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Prevent changing own role from admin (security)
        if (user._id.toString() === req.user._id.toString() && role && role !== 'admin') {
            return res.status(403).json({ error: 'Cannot change your own admin role' });
        }
        
        if (name) user.name = name;
        if (role) user.role = role;
        if (company !== undefined) user.company = company;
        if (isActive !== undefined) user.isActive = isActive;
        
        await user.save();
        
        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
                isActive: user.isActive
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (soft delete or hard delete)
router.delete('/users/:id', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Prevent deleting yourself
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(403).json({ error: 'Cannot delete your own account' });
        }
        
        // Option 1: Hard delete
        await user.deleteOne();
        
        // Option 2: Soft delete (uncomment if preferred)
        // user.isActive = false;
        // await user.save();
        
        res.json({
            success: true,
            message: `User ${user.email} deleted successfully`
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
router.get('/stats', async (req, res, next) => {
    try {
        const [
            totalUsers,
            totalClients,
            totalDevelopers,
            totalTasks,
            pendingTasks,
            completedTasks,
            recentTasks
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'client' }),
            User.countDocuments({ role: 'developer' }),
            Task.countDocuments(),
            Task.countDocuments({ status: 'pending' }),
            Task.countDocuments({ status: 'completed' }),
            Task.find().sort({ createdAt: -1 }).limit(5).populate('assignedTo', 'name')
        ]);
        
        res.json({
            users: {
                total: totalUsers,
                clients: totalClients,
                developers: totalDevelopers,
                admins: totalUsers - totalClients - totalDevelopers
            },
            tasks: {
                total: totalTasks,
                pending: pendingTasks,
                completed: completedTasks,
                completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0
            },
            recentTasks
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/admin/reset-user-password
// @desc    Force reset user password (admin only)
router.post('/reset-user-password/:id', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const newTempPassword = crypto.randomBytes(8).toString('hex');
        user.password = newTempPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        
        await sendInvitationEmail(user.email, user.name, newTempPassword, user.role);
        
        res.json({
            success: true,
            message: `Password reset email sent to ${user.email}`,
            tempPassword: process.env.NODE_ENV === 'development' ? newTempPassword : undefined
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;