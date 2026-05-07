const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// ======================================================
// MARK ATTENDANCE (Developer)
// ======================================================

router.post('/mark', authenticate, async (req, res, next) => {
    try {
        const { status, checkIn, checkOut, hadWork, workDescription } = req.body;
        
        if (req.user.role !== 'developer' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only developers and admins can mark attendance' });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let attendance = await Attendance.findOne({
            developerId: req.user._id,
            date: today
        });
        
        if (attendance) {
            // Update existing
            attendance.status = status || attendance.status;
            attendance.checkIn = checkIn || attendance.checkIn;
            attendance.checkOut = checkOut || attendance.checkOut;
            attendance.hadWork = hadWork !== undefined ? hadWork : attendance.hadWork;
            attendance.workDescription = workDescription || attendance.workDescription;
            attendance.updatedAt = new Date();
            
            // Calculate hours worked
            if (checkIn && checkOut) {
                const [inHour, inMin] = checkIn.split(':');
                const [outHour, outMin] = checkOut.split(':');
                const totalMinutes = ((parseInt(outHour) * 60 + parseInt(outMin)) - (parseInt(inHour) * 60 + parseInt(inMin)));
                attendance.hoursWorked = Math.max(0, totalMinutes / 60);
            }
        } else {
            // Create new
            attendance = new Attendance({
                developerId: req.user._id,
                date: today,
                status: status || 'present',
                checkIn: checkIn || null,
                checkOut: checkOut || null,
                hadWork: hadWork !== undefined ? hadWork : true,
                workDescription: workDescription || '',
                markedBy: req.user._id,
                hoursWorked: 0
            });
            
            // Calculate hours worked
            if (checkIn && checkOut) {
                const [inHour, inMin] = checkIn.split(':');
                const [outHour, outMin] = checkOut.split(':');
                const totalMinutes = ((parseInt(outHour) * 60 + parseInt(outMin)) - (parseInt(inHour) * 60 + parseInt(inMin)));
                attendance.hoursWorked = Math.max(0, totalMinutes / 60);
            }
        }
        
        await attendance.save();
        
        res.json({
            success: true,
            message: 'Attendance marked successfully',
            attendance
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET MY ATTENDANCE (Developer)
// ======================================================

router.get('/my-attendance', authenticate, async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        let query = { developerId: req.user._id };
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const attendance = await Attendance.find(query).sort({ date: -1 });
        
        // Calculate summary
        const summary = {
            totalDays: attendance.length,
            present: attendance.filter(a => a.status === 'present').length,
            absent: attendance.filter(a => a.status === 'absent').length,
            late: attendance.filter(a => a.status === 'late').length,
            halfDay: attendance.filter(a => a.status === 'half-day').length,
            totalHours: attendance.reduce((sum, a) => sum + (a.hoursWorked || 0), 0).toFixed(1)
        };
        
        res.json({
            success: true,
            summary,
            attendance
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET ALL ATTENDANCE (Admin)
// ======================================================

router.get('/all', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { startDate, endDate, developerId } = req.query;
        let query = {};
        
        if (developerId) query.developerId = developerId;
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const attendance = await Attendance.find(query)
            .populate('developerId', 'name email')
            .populate('markedBy', 'name')
            .sort({ date: -1 });
        
        res.json({
            success: true,
            count: attendance.length,
            attendance
        });
    } catch (error) {
        next(error);
    }
});

// ======================================================
// GET ATTENDANCE STATISTICS (Admin)
// ======================================================

router.get('/stats', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const developers = await User.find({ role: 'developer', isActive: true });
        
        const stats = await Promise.all(developers.map(async (dev) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            
            const attendance = await Attendance.find({
                developerId: dev._id,
                date: { $gte: startOfMonth, $lte: today }
            });
            
            return {
                developerId: dev._id,
                name: dev.name,
                email: dev.email,
                totalDays: attendance.length,
                present: attendance.filter(a => a.status === 'present').length,
                absent: attendance.filter(a => a.status === 'absent').length,
                late: attendance.filter(a => a.status === 'late').length,
                totalHours: attendance.reduce((sum, a) => sum + (a.hoursWorked || 0), 0).toFixed(1)
            };
        }));
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
