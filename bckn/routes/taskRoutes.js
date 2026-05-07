const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// ======================================================
// COMMON POPULATE OBJECT
// ======================================================

const taskPopulate = [
    { path: 'createdBy', select: 'name email role' },
    { path: 'assignedTo', select: 'name email role' },
    { path: 'clientId', select: 'name email company role' },
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
        
        if (req.user.role === 'client') {
            query.clientId = req.user._id;
        } else if (req.user.role === 'developer') {
            query.assignedTo = req.user._id;
        }
        
        // Advanced filters
        if (req.query.status) query.status = req.query.status;
        if (req.query.priority) query.priority = req.query.priority;
        if (req.query.workflowStage) query.workflowStage = req.query.workflowStage;
        if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
        if (req.query.clientId) query.clientId = req.query.clientId;
        
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
        
        res.json({ success: true, page, limit, total, count: tasks.length, tasks });
    } catch (error) { next(error); }
});

// ======================================================
// GET SINGLE TASK
// ======================================================

router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, isDeleted: false }).populate(taskPopulate);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        
        const hasAccess = req.user.role === 'admin' ||
            task.assignedTo?._id?.toString() === req.user._id.toString() ||
            task.clientId?._id?.toString() === req.user._id.toString() ||
            task.createdBy?._id?.toString() === req.user._id.toString();
        
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });
        res.json({ success: true, task });
    } catch (error) { next(error); }
});

// ======================================================
// CREATE TASK
// ======================================================

router.post('/', authenticate, requireRole('admin', 'client'), async (req, res, next) => {
    try {
        const { title, description, assignedTo, clientId, priority, workflowStage, startDate, dueDate, estimatedHours, tags } = req.body;
        
        const developer = await User.findOne({ _id: assignedTo, role: 'developer' });
        if (!developer) return res.status(400).json({ error: 'Assigned developer not found' });
        
        let finalClientId = clientId;
        if (req.user.role === 'client') finalClientId = req.user._id;
        if (!finalClientId) return res.status(400).json({ error: 'Client ID is required' });
        
        const client = await User.findOne({ _id: finalClientId, role: 'client' });
        if (!client) return res.status(400).json({ error: 'Client not found' });
        
        const task = new Task({
            title, description, priority: priority || 'medium',
            workflowStage: workflowStage || 'planning', status: 'todo',
            createdBy: req.user._id, assignedTo, clientId: finalClientId,
            startDate, dueDate, estimatedHours: estimatedHours || 0,
            tags: tags || [], checklist: [], watchers: [],
            activityLogs: [{ action: 'TASK_CREATED', performedBy: req.user._id, newValue: { title, status: 'todo' } }]
        });
        
        await task.save();
        await task.populate(taskPopulate);
        res.status(201).json({ success: true, message: 'Task created successfully', task });
    } catch (error) { next(error); }
});

// ======================================================
// UPDATE TASK
// ======================================================

router.put('/:id', authenticate, async (req, res, next) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, isDeleted: false });
        if (!task) return res.status(404).json({ error: 'Task not found' });
        
        const isAdmin = req.user.role === 'admin';
        const isAssignedDeveloper = task.assignedTo?.toString() === req.user._id.toString();
        const isClient = task.clientId?.toString() === req.user._id.toString();
        
        if (!isAdmin && !isAssignedDeveloper && !isClient) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const previousData = { status: task.status, priority: task.priority, workflowStage: task.workflowStage };
        const allowedFields = ['title', 'description', 'status', 'priority', 'workflowStage', 'assignedTo', 'dueDate', 'startDate', 'estimatedHours', 'actualHours', 'tags', 'checklist'];
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) task[field] = req.body[field];
        });
        
        if (req.body.status === 'completed') task.completedAt = new Date();
        
        task.activityLogs.push({
            action: 'TASK_UPDATED', performedBy: req.user._id,
            oldValue: previousData, newValue: req.body
        });
        
        await task.save();
        await task.populate(taskPopulate);
        res.json({ success: true, message: 'Task updated successfully', task });
    } catch (error) { next(error); }
});

// ======================================================
// ADD COMMENT
// ======================================================

router.post('/:id/comments', authenticate, async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || task.isDeleted) return res.status(404).json({ error: 'Task not found' });
        
        const hasAccess = req.user.role === 'admin' ||
            task.assignedTo?.toString() === req.user._id.toString() ||
            task.clientId?.toString() === req.user._id.toString() ||
            task.createdBy?.toString() === req.user._id.toString();
        
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });
        
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: 'Comment text is required' });
        
        task.comments.push({
            text: text.trim(), author: req.user.name,
            authorId: req.user._id, authorRole: req.user.role
        });
        
        task.activityLogs.push({ action: 'COMMENT_ADDED', performedBy: req.user._id, newValue: { comment: text.trim() } });
        await task.save();
        await task.populate(taskPopulate);
        res.status(201).json({ success: true, message: 'Comment added successfully', comments: task.comments });
    } catch (error) { next(error); }
});

// ======================================================
// GET COMMENTS
// ======================================================

router.get('/:id/comments', authenticate, async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || task.isDeleted) return res.status(404).json({ error: 'Task not found' });
        
        const hasAccess = req.user.role === 'admin' ||
            task.assignedTo?.toString() === req.user._id.toString() ||
            task.clientId?.toString() === req.user._id.toString() ||
            task.createdBy?.toString() === req.user._id.toString();
        
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });
        
        res.json({ success: true, count: task.comments.length, comments: task.comments });
    } catch (error) { next(error); }
});

// ======================================================
// ADD CHECKLIST ITEM
// ======================================================

router.post('/:id/checklist', authenticate, async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || task.isDeleted) return res.status(404).json({ error: 'Task not found' });
        
        task.checklist.push({ text: req.body.text });
        task.activityLogs.push({ action: 'CHECKLIST_ITEM_ADDED', performedBy: req.user._id, newValue: { text: req.body.text } });
        await task.save();
        res.json({ success: true, checklist: task.checklist });
    } catch (error) { next(error); }
});

// ======================================================
// DELETE TASK (SOFT DELETE)
// ======================================================

router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        
        task.isDeleted = true;
        task.deletedAt = new Date();
        task.deletedBy = req.user._id;
        task.activityLogs.push({ action: 'TASK_DELETED', performedBy: req.user._id });
        await task.save();
        res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) { next(error); }
});

// ======================================================
// TASK DASHBOARD STATS
// ======================================================

router.get('/stats/dashboard', authenticate, async (req, res, next) => {
    try {
        let query = { isDeleted: false };
        if (req.user.role === 'client') query.clientId = req.user._id;
        else if (req.user.role === 'developer') query.assignedTo = req.user._id;
        
        const total = await Task.countDocuments(query);
        const todo = await Task.countDocuments({ ...query, status: 'todo' });
        const inProgress = await Task.countDocuments({ ...query, status: 'in-progress' });
        const review = await Task.countDocuments({ ...query, status: 'in-review' });
        const blocked = await Task.countDocuments({ ...query, status: 'blocked' });
        const completed = await Task.countDocuments({ ...query, status: 'completed' });
        const overdue = await Task.countDocuments({ ...query, dueDate: { $lt: new Date() }, status: { $ne: 'completed' } });
        
        res.json({
            success: true,
            stats: { total, todo, inProgress, review, blocked, completed, overdue, completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0 }
        });
    } catch (error) { next(error); }
});

module.exports = router;
