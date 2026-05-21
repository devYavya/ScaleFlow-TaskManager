const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const { authenticate } = require('../middleware/auth');
const { sendInvitationEmail } = require('../utils/emailService');
const crypto = require('crypto');

// All routes require authentication
router.use(authenticate);

// ======================================================
// GET CLIENT'S TEAM MEMBERS
// ======================================================
router.get('/team-members', async (req, res, next) => {
    try {
        // Only clients can access this
        if (req.user.role !== 'client') {
            return res.status(403).json({ 
                error: 'Access denied. Only clients can access team members.' 
            });
        }

        // Get all team members (client-team role) for this client
        const teamMembers = await User.find({
            role: 'client-team',
            clientId: req.user._id,
            isActive: true
        }).select('-password -resetToken -resetTokenExpiry');

        // Get task statistics for each team member
        const membersWithStats = await Promise.all(teamMembers.map(async (member) => {
            const memberTasks = await Task.find({ 
                createdBy: member._id,
                clientId: req.user._id
            });
            
            const completedTasks = memberTasks.filter(t => t.status === 'completed').length;
            const inProgressTasks = memberTasks.filter(t => t.status === 'in-progress').length;
            const pendingTasks = memberTasks.filter(t => t.status === 'pending').length;
            
            return {
                _id: member._id,
                name: member.name,
                email: member.email,
                role: member.role,
                isActive: member.isActive,
                createdAt: member.createdAt,
                stats: {
                    totalTasks: memberTasks.length,
                    completed: completedTasks,
                    inProgress: inProgressTasks,
                    pending: pendingTasks,
                    completionRate: memberTasks.length > 0 
                        ? Math.round((completedTasks / memberTasks.length) * 100) 
                        : 0
                }
            };
        }));

        // Calculate remaining slots (max 2 team members)
        const maxTeamMembers = 2;
        const remainingSlots = Math.max(0, maxTeamMembers - teamMembers.length);

        res.json({
            success: true,
            teamMembers: membersWithStats,
            count: membersWithStats.length,
            maxAllowed: maxTeamMembers,
            remainingSlots: remainingSlots
        });

    } catch (error) {
        console.error('Error fetching team members:', error);
        next(error);
    }
});

// ======================================================
// INVITE NEW TEAM MEMBER
// ======================================================
router.post('/invite-team-member', async (req, res, next) => {
    try {
        // Only clients can access this
        if (req.user.role !== 'client') {
            return res.status(403).json({ 
                error: 'Access denied. Only clients can invite team members.' 
            });
        }

        const { name, email } = req.body;

        // Validate input
        if (!name || !email) {
            return res.status(400).json({ 
                error: 'Name and email are required' 
            });
        }

        // Check current team member count (max 2)
        const currentTeamMembers = await User.countDocuments({
            role: 'client-team',
            clientId: req.user._id,
            isActive: true
        });

        if (currentTeamMembers >= 2) {
            return res.status(400).json({
                error: 'You have reached the maximum limit of 2 team members. Please remove an existing member to add a new one.'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                error: 'User already exists with this email' 
            });
        }

        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');

        // Create new team member
        const newTeamMember = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: tempPassword,
            role: 'client-team',
            company: req.user.company || '',
            clientId: req.user._id,
            createdBy: req.user._id,
            isActive: true
        });

        await newTeamMember.save();

        // Send invitation email
        const emailResult = await sendInvitationEmail(
            email, 
            name, 
            tempPassword, 
            'client-team'
        );

        const remainingSlots = 2 - (currentTeamMembers + 1);

        res.status(201).json({
            success: true,
            message: `Team member invited successfully! ${remainingSlots} slot(s) remaining.`,
            teamMember: {
                _id: newTeamMember._id,
                name: newTeamMember.name,
                email: newTeamMember.email,
                role: newTeamMember.role,
                createdAt: newTeamMember.createdAt
            },
            remainingSlots: remainingSlots,
            tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
        });

    } catch (error) {
        console.error('Error inviting team member:', error);
        next(error);
    }
});

// ======================================================
// REMOVE TEAM MEMBER
// ======================================================
router.delete('/team-members/:id', async (req, res, next) => {
    try {
        // Only clients can access this
        if (req.user.role !== 'client') {
            return res.status(403).json({ 
                error: 'Access denied. Only clients can remove team members.' 
            });
        }

        const memberId = req.params.id;

        // Verify team member belongs to this client
        const teamMember = await User.findOne({
            _id: memberId,
            role: 'client-team',
            clientId: req.user._id
        });

        if (!teamMember) {
            return res.status(404).json({ 
                error: 'Team member not found' 
            });
        }

        // Check if member has active tasks
        const activeTasks = await Task.countDocuments({
            createdBy: memberId,
            clientId: req.user._id,
            status: { $in: ['pending', 'in-progress', 'todo'] }
        });

        if (activeTasks > 0) {
            return res.status(400).json({
                error: `Cannot remove team member with ${activeTasks} active task(s). Please wait for tasks to be completed.`
            });
        }

        // Soft delete (deactivate)
        teamMember.isActive = false;
        await teamMember.save();

        // Get updated count
        const remainingTeamMembers = await User.countDocuments({
            role: 'client-team',
            clientId: req.user._id,
            isActive: true
        });

        res.json({
            success: true,
            message: `Team member ${teamMember.name} has been removed`,
            remainingSlots: 2 - remainingTeamMembers
        });

    } catch (error) {
        console.error('Error removing team member:', error);
        next(error);
    }
});

// ======================================================
// GET TEAM MEMBER TASKS
// ======================================================
router.get('/team-members/:id/tasks', async (req, res, next) => {
    try {
        // Only clients can access this
        if (req.user.role !== 'client') {
            return res.status(403).json({ 
                error: 'Access denied. Only clients can view team member tasks.' 
            });
        }

        const memberId = req.params.id;

        // Verify team member belongs to this client
        const teamMember = await User.findOne({
            _id: memberId,
            role: 'client-team',
            clientId: req.user._id,
            isActive: true
        });

        if (!teamMember) {
            return res.status(404).json({ 
                error: 'Team member not found' 
            });
        }

        // Get tasks created by this team member
        const tasks = await Task.find({ 
            createdBy: memberId,
            clientId: req.user._id,
            isDeleted: false
        })
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            member: {
                _id: teamMember._id,
                name: teamMember.name,
                email: teamMember.email
            },
            tasks: tasks,
            count: tasks.length
        });

    } catch (error) {
        console.error('Error fetching member tasks:', error);
        next(error);
    }
});

// ======================================================
// GET ALL TASKS (Client + Team Members)
// ======================================================
router.get('/all-tasks', async (req, res, next) => {
    try {
        // Only clients can access this
        if (req.user.role !== 'client') {
            return res.status(403).json({ 
                error: 'Access denied. Only clients can view all tasks.' 
            });
        }

        // Get all team members under this client
        const teamMembers = await User.find({
            role: 'client-team',
            clientId: req.user._id,
            isActive: true
        }).select('_id');

        const teamMemberIds = teamMembers.map(m => m._id);

        // Get tasks created by team members
        const teamTasks = await Task.find({
            createdBy: { $in: teamMemberIds },
            clientId: req.user._id,
            isDeleted: false
        })
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 });

        // Get tasks created by the client themselves
        const clientTasks = await Task.find({
            createdBy: req.user._id,
            clientId: req.user._id,
            isDeleted: false
        })
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 });

        // Combine and sort
        const allTasks = [...teamTasks, ...clientTasks];
        allTasks.sort((a, b) => b.createdAt - a.createdAt);

        res.json({
            success: true,
            count: allTasks.length,
            tasks: allTasks,
            stats: {
                myTasks: clientTasks.length,
                teamTasks: teamTasks.length
            }
        });

    } catch (error) {
        console.error('Error fetching all tasks:', error);
        next(error);
    }
});

// ======================================================
// GET TEAM STATISTICS
// ======================================================
router.get('/team-stats', async (req, res, next) => {
    try {
        // Only clients can access this
        if (req.user.role !== 'client') {
            return res.status(403).json({ 
                error: 'Access denied. Only clients can view team statistics.' 
            });
        }

        const teamMembers = await User.find({
            role: 'client-team',
            clientId: req.user._id,
            isActive: true
        });

        const allTasks = await Task.find({ 
            clientId: req.user._id,
            isDeleted: false 
        });

        const myTasks = allTasks.filter(t => t.createdBy?.toString() === req.user._id.toString());
        const teamTasks = allTasks.filter(t => t.createdByRole === 'client-team');

        const teamStats = {
            totalMembers: teamMembers.length,
            maxMembers: 2,
            remainingSlots: Math.max(0, 2 - teamMembers.length),
            totalTasks: allTasks.length,
            myTasks: myTasks.length,
            teamTasks: teamTasks.length,
            completedTasks: allTasks.filter(t => t.status === 'completed').length,
            inProgressTasks: allTasks.filter(t => t.status === 'in-progress').length,
            pendingTasks: allTasks.filter(t => t.status === 'pending').length,
            completionRate: allTasks.length > 0 
                ? Math.round((allTasks.filter(t => t.status === 'completed').length / allTasks.length) * 100)
                : 0
        };

        res.json({
            success: true,
            teamStats: teamStats
        });

    } catch (error) {
        console.error('Error fetching team stats:', error);
        next(error);
    }
});

module.exports = router;