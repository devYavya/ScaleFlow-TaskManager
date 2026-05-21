const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// ======================================================
// COMMON POPULATE OBJECT
// ======================================================

const taskPopulate = [
    { path: 'createdBy', select: 'name email role' },
    { path: 'assignedTo', select: 'name email role' },
    { path: 'clientId', select: 'name email company role' },
    { path: 'teamMemberId', select: 'name email role' },
    { path: 'watchers', select: 'name email role' },
    { path: 'blockedBy', select: 'title taskNumber status' },
    { path: 'comments.authorId', select: 'name email role' },
    { path: 'activityLogs.performedBy', select: 'name email role' }
];

// ======================================================
// GET ALL TASKS
// ======================================================

router.get('/', authenticate, async (req, res, next) => {
    try {
        let query = { isDeleted: false };

        // Role-based filtering
        if (req.user.role === 'client') {
            // Client sees all tasks from their company (including team member tasks)
            query.clientId = req.user._id;
        } else if (req.user.role === 'client-team') {
            // Team member sees tasks they created
            query.createdBy = req.user._id;
            query.clientId = req.user.clientId;
        } else if (req.user.role === 'developer') {
            query.assignedTo = req.user._id;
        }

        // Advanced filters
        if (req.query.status) query.status = req.query.status;
        if (req.query.priority) query.priority = req.query.priority;
        if (req.query.workflowStage) query.workflowStage = req.query.workflowStage;
        if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
        if (req.query.createdBy) query.createdBy = req.query.createdBy;
        if (req.query.clientId && (req.user.role === 'admin' || req.user.role === 'client')) {
            query.clientId = req.query.clientId;
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        const tasks = await Task.find(query)
            .populate(taskPopulate)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Task.countDocuments(query);

        res.json({
            success: true,
            page,
            limit,
            total,
            count: tasks.length,
            tasks
        });

    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET SINGLE TASK
// ======================================================

router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const task = await Task.findOne({
            _id: req.params.id,
            isDeleted: false
        }).populate(taskPopulate);

        if (!task) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        // Check access based on user role
        let hasAccess = false;
        
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (req.user.role === 'client') {
            hasAccess = task.clientId?._id?.toString() === req.user._id.toString();
        } else if (req.user.role === 'client-team') {
            hasAccess = task.createdBy?._id?.toString() === req.user._id.toString() ||
                       task.clientId?._id?.toString() === req.user.clientId?.toString();
        } else if (req.user.role === 'developer') {
            hasAccess = task.assignedTo?._id?.toString() === req.user._id.toString();
        }

        if (!hasAccess) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        res.json({
            success: true,
            task
        });

    } catch (error) {
        next(error);
    }
});

// ======================================================
// CREATE TASK
// ======================================================

router.post(
    '/',
    authenticate,
    requireRole('admin', 'client', 'client-team'),
    async (req, res, next) => {
        try {

            let {
                title,
                description,
                assignedTo,
                clientId,
                priority,
                workflowStage,
                startDate,
                dueDate,
                estimatedHours,
                tags
            } = req.body;

            // ======================================================
            // VALIDATIONS
            // ======================================================

            if (!title?.trim()) {
                return res.status(400).json({
                    error: 'Title is required'
                });
            }

            if (!description?.trim()) {
                return res.status(400).json({
                    error: 'Description is required'
                });
            }

            // ======================================================
            // ROLE-BASED HANDLING
            // ======================================================

            let teamMemberId = null;
            let createdByRole = req.user.role;

            if (req.user.role === 'client') {
                // Client creating task for themselves
                clientId = req.user._id;
                assignedTo = null;
                workflowStage = 'planning';
                startDate = null;
                dueDate = null;
                estimatedHours = 0;
                tags = [];
                
            } else if (req.user.role === 'client-team') {
                // Team member creating task for their client
                if (!req.user.clientId) {
                    return res.status(400).json({
                        error: 'Team member not associated with any client'
                    });
                }
                clientId = req.user.clientId;
                teamMemberId = req.user._id;
                assignedTo = null;
                workflowStage = 'planning';
                startDate = null;
                dueDate = null;
                estimatedHours = 0;
                tags = [];
                
            } else if (req.user.role === 'admin') {
                // Admin creating task - need clientId
                if (!clientId) {
                    return res.status(400).json({
                        error: 'Client ID is required when creating task as admin'
                    });
                }
            }

            // ======================================================
            // VALIDATE ASSIGNED DEVELOPER
            // ======================================================

            let developer = null;

            if (assignedTo) {
                developer = await User.findOne({
                    _id: assignedTo,
                    role: 'developer'
                });

                if (!developer) {
                    return res.status(400).json({
                        error: 'Assigned developer not found'
                    });
                }
            }

            // ======================================================
            // VALIDATE CLIENT
            // ======================================================

            if (!clientId) {
                return res.status(400).json({
                    error: 'Client ID is required'
                });
            }

            const client = await User.findOne({
                _id: clientId,
                role: 'client'
            });

            if (!client) {
                return res.status(400).json({
                    error: 'Client not found'
                });
            }

            // ======================================================
            // TASK CREATION
            // ======================================================

            const task = new Task({
                title: title.trim(),
                description: description.trim(),
                priority: priority || 'medium',
                workflowStage: workflowStage || 'planning',
                status: (req.user.role === 'client' || req.user.role === 'client-team') 
                    ? 'pending' 
                    : 'todo',
                createdBy: req.user._id,
                createdByRole: createdByRole,
                assignedTo: assignedTo || null,
                clientId: clientId,
                teamMemberId: teamMemberId,
                startDate,
                dueDate,
                estimatedHours: estimatedHours || 0,
                tags: tags || [],
                checklist: [],
                watchers: [],
                source: req.user.role === 'client-team' ? 'team-member-portal' : 'client-portal',
                activityLogs: [
                    {
                        action: 'TASK_CREATED',
                        performedBy: req.user._id,
                        performedByRole: req.user.role,
                        newValue: {
                            title,
                            status: (req.user.role === 'client' || req.user.role === 'client-team') 
                                ? 'pending' 
                                : 'todo'
                        }
                    }
                ]
            });

            await task.save();
            await task.populate(taskPopulate);

            res.status(201).json({
                success: true,
                message: 'Task created successfully',
                task
            });

        } catch (error) {
            next(error);
        }
    }
);

// ======================================================
// UPDATE TASK
// ======================================================
// ======================================================
// UPDATE TASK
// ======================================================

router.put('/:id', authenticate, async (req, res, next) => {
    try {
        // ======================================================
        // SANITIZE INPUT - Remove fields that shouldn't be updated
        // ======================================================
        
        const sanitizedBody = {};
        const allowedFields = {
            admin: ['title', 'description', 'status', 'priority', 'workflowStage', 'assignedTo', 
                    'dueDate', 'startDate', 'estimatedHours', 'actualHours', 'tags', 'checklist', 
                    'milestone', 'sprint'],
            developer: ['status', 'actualHours', 'checklist', 'workflowStage'],
            client: ['title', 'description', 'priority'],
            'client-team': ['title', 'description', 'priority']
        };
        
        // Fields that should NEVER be updated
        const immutableFields = ['_id', 'createdBy', 'createdByRole', 'clientId', 'teamMemberId', 
                                 'taskNumber', 'isDeleted', 'deletedAt', 'deletedBy', 'activityLogs'];
        
        // Sanitize request body
        Object.keys(req.body).forEach(key => {
            // Skip immutable fields
            if (immutableFields.includes(key)) {
                console.log(`Skipping immutable field: ${key}`);
                return;
            }
            
            // Skip undefined/null/empty values
            const value = req.body[key];
            if (value === undefined || value === null || value === '' || value === 'undefined') {
                console.log(`Skipping empty field: ${key}`);
                return;
            }
            
            sanitizedBody[key] = value;
        });

        if (Object.keys(sanitizedBody).length === 0) {
            return res.status(400).json({
                error: 'No valid fields to update'
            });
        }

        // Find the task
        const task = await Task.findOne({
            _id: req.params.id,
            isDeleted: false
        });

        if (!task) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        // Check permissions
        const isAdmin = req.user.role === 'admin';
        const isAssignedDeveloper = task.assignedTo?.toString() === req.user._id.toString();
        const isClient = task.clientId?.toString() === req.user._id.toString();
        const isCreator = task.createdBy?.toString() === req.user._id.toString();

        let hasAccess = false;
        
        if (isAdmin) hasAccess = true;
        else if (isAssignedDeveloper) hasAccess = true;
        else if (isClient) hasAccess = true;
        else if (isCreator && req.user.role === 'client-team') hasAccess = true;

        if (!hasAccess) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        // Determine allowed fields based on role
        let allowedRoleFields = [];
        if (isAdmin) allowedRoleFields = allowedFields.admin;
        else if (isAssignedDeveloper) allowedRoleFields = allowedFields.developer;
        else if (isClient) allowedRoleFields = allowedFields.client;
        else if (isCreator && req.user.role === 'client-team') allowedRoleFields = allowedFields['client-team'];

        // Store old values for activity log
        const previousData = {
            status: task.status,
            priority: task.priority,
            workflowStage: task.workflowStage,
            assignedTo: task.assignedTo,
            title: task.title,
            description: task.description,
            actualHours: task.actualHours
        };

        // Apply updates
        let hasUpdates = false;
        allowedRoleFields.forEach(field => {
            if (sanitizedBody[field] !== undefined) {
                // Special handling for actualHours (ensure it's a number)
                if (field === 'actualHours') {
                    task[field] = parseFloat(sanitizedBody[field]) || 0;
                } else {
                    task[field] = sanitizedBody[field];
                }
                hasUpdates = true;
            }
        });

        if (!hasUpdates) {
            return res.status(400).json({
                error: 'No valid fields to update based on your role'
            });
        }

        // Set completion date if status changed to completed
        if (sanitizedBody.status === 'completed' && task.status !== 'completed') {
            task.completedAt = new Date();
        }

        // Add activity log
        task.activityLogs.push({
            action: 'TASK_UPDATED',
            performedBy: req.user._id,
            performedByRole: req.user.role,
            oldValue: previousData,
            newValue: sanitizedBody
        });

        // Save with validation options
        await task.save({ validateModifiedOnly: true });
        await task.populate(taskPopulate);

        res.json({
            success: true,
            message: 'Task updated successfully',
            task
        });

    } catch (error) {
        console.error('Update error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                error: 'Validation Error',
                details: errors
            });
        }
        
        // Handle CastError
        if (error.name === 'CastError') {
            return res.status(400).json({
                error: 'Invalid ID format',
                details: error.message
            });
        }
        
        next(error);
    }
});

// ======================================================
// ADD COMMENT
// ======================================================

router.post('/:id/comments', authenticate, async (req, res, next) => {
    try {

        const task = await Task.findById(req.params.id);

        if (!task || task.isDeleted) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        // Check access
        let hasAccess = false;
        
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (req.user.role === 'client') {
            hasAccess = task.clientId?.toString() === req.user._id.toString();
        } else if (req.user.role === 'client-team') {
            hasAccess = task.createdBy?.toString() === req.user._id.toString() ||
                       task.clientId?.toString() === req.user.clientId?.toString();
        } else if (req.user.role === 'developer') {
            hasAccess = task.assignedTo?.toString() === req.user._id.toString();
        }

        if (!hasAccess) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const { text } = req.body;

        if (!text?.trim()) {
            return res.status(400).json({
                error: 'Comment text is required'
            });
        }

        task.comments.push({
            text: text.trim(),
            author: req.user.name,
            authorId: req.user._id,
            authorRole: req.user.role
        });

        task.activityLogs.push({
            action: 'COMMENT_ADDED',
            performedBy: req.user._id,
            performedByRole: req.user.role,
            newValue: {
                comment: text.trim()
            }
        });

        await task.save();
        await task.populate(taskPopulate);

        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            comments: task.comments
        });

    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET COMMENTS
// ======================================================

router.get('/:id/comments', authenticate, async (req, res, next) => {
    try {

        const task = await Task.findById(req.params.id);

        if (!task || task.isDeleted) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        // Check access
        let hasAccess = false;
        
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (req.user.role === 'client') {
            hasAccess = task.clientId?.toString() === req.user._id.toString();
        } else if (req.user.role === 'client-team') {
            hasAccess = task.createdBy?.toString() === req.user._id.toString() ||
                       task.clientId?.toString() === req.user.clientId?.toString();
        } else if (req.user.role === 'developer') {
            hasAccess = task.assignedTo?.toString() === req.user._id.toString();
        }

        if (!hasAccess) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        res.json({
            success: true,
            count: task.comments.length,
            comments: task.comments
        });

    } catch (error) {
        next(error);
    }
});

// ======================================================
// ADD CHECKLIST ITEM
// ======================================================

router.post('/:id/checklist', authenticate, async (req, res, next) => {
    try {

        const task = await Task.findById(req.params.id);

        if (!task || task.isDeleted) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        // Only admins and assigned developers can add checklist items
        const canModify = req.user.role === 'admin' || 
                         task.assignedTo?.toString() === req.user._id.toString();

        if (!canModify) {
            return res.status(403).json({
                error: 'Only admins and assigned developers can modify checklist'
            });
        }

        task.checklist.push({
            text: req.body.text,
            completed: false
        });

        task.activityLogs.push({
            action: 'CHECKLIST_ITEM_ADDED',
            performedBy: req.user._id,
            performedByRole: req.user.role,
            newValue: {
                text: req.body.text
            }
        });

        await task.save();

        res.json({
            success: true,
            checklist: task.checklist
        });

    } catch (error) {
        next(error);
    }
});

// ======================================================
// DELETE TASK (SOFT DELETE)
// ======================================================

router.delete(
    '/:id',
    authenticate,
    requireRole('admin'),
    async (req, res, next) => {
        try {

            const task = await Task.findById(req.params.id);

            if (!task) {
                return res.status(404).json({
                    error: 'Task not found'
                });
            }

            task.isDeleted = true;
            task.deletedAt = new Date();
            task.deletedBy = req.user._id;

            task.activityLogs.push({
                action: 'TASK_DELETED',
                performedBy: req.user._id,
                performedByRole: req.user.role
            });

            await task.save();

            res.json({
                success: true,
                message: 'Task deleted successfully'
            });

        } catch (error) {
            next(error);
        }
    }
);

// ======================================================
// TASK DASHBOARD STATS
// ======================================================

router.get('/stats/dashboard', authenticate, async (req, res, next) => {
    try {

        let query = { isDeleted: false };

        if (req.user.role === 'client') {
            query.clientId = req.user._id;
        } else if (req.user.role === 'client-team') {
            query.createdBy = req.user._id;
            query.clientId = req.user.clientId;
        } else if (req.user.role === 'developer') {
            query.assignedTo = req.user._id;
        }

        const total = await Task.countDocuments(query);

        const pending = await Task.countDocuments({
            ...query,
            status: 'pending'
        });

        const todo = await Task.countDocuments({
            ...query,
            status: 'todo'
        });

        const inProgress = await Task.countDocuments({
            ...query,
            status: 'in-progress'
        });

        const review = await Task.countDocuments({
            ...query,
            status: 'in-review'
        });

        const blocked = await Task.countDocuments({
            ...query,
            status: 'blocked'
        });

        const completed = await Task.countDocuments({
            ...query,
            status: 'completed'
        });

        const overdue = await Task.countDocuments({
            ...query,
            dueDate: { $lt: new Date() },
            status: { $ne: 'completed' }
        });

        // Get tasks created by team members for clients
        let teamMemberTasks = 0;
        if (req.user.role === 'client') {
            teamMemberTasks = await Task.countDocuments({
                clientId: req.user._id,
                createdByRole: 'client-team',
                isDeleted: false
            });
        }

        res.json({
            success: true,
            stats: {
                total,
                pending,
                todo,
                inProgress,
                review,
                blocked,
                completed,
                overdue,
                teamMemberTasks: teamMemberTasks || 0,
                completionRate: total > 0
                    ? ((completed / total) * 100).toFixed(1)
                    : 0
            }
        });

    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET TASKS BY CLIENT (For client dashboard)
// ======================================================

router.get('/client/:clientId/tasks', authenticate, async (req, res, next) => {
    try {
        const { clientId } = req.params;
        
        // Check access
        if (req.user.role !== 'admin' && req.user._id.toString() !== clientId) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const tasks = await Task.find({
            clientId: clientId,
            isDeleted: false
        })
        .populate(taskPopulate)
        .sort({ createdAt: -1 });

        // Separate client tasks from team member tasks
        const clientTasks = tasks.filter(t => t.createdByRole === 'client');
        const teamMemberTasks = tasks.filter(t => t.createdByRole === 'client-team');

        res.json({
            success: true,
            total: tasks.length,
            clientTasks: {
                count: clientTasks.length,
                tasks: clientTasks
            },
            teamMemberTasks: {
                count: teamMemberTasks.length,
                tasks: teamMemberTasks
            },
            allTasks: tasks
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;