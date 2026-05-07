require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import middleware
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const adminRoutes = require('./routes/adminRoutes');
const logRoutes = require('./routes/logRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');


const app = express();

// Middleware
app.use(cors({
    origin: [
        'https://task-tracker.scaleflowsoftware.com'
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ SERVE STATIC FRONTEND FILES ============
// Serve all files from the frontend folder
const frontendPath = path.join(__dirname, '../ui');
console.log('📁 Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Filter out favicon requests from logging
app.use((req, res, next) => {
    if (req.url === '/favicon.ico') {
        return res.status(204).end();
    }
    next();
});

// ============ HEALTH CHECK ENDPOINTS ============
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ============ ROOT ENDPOINT ============
app.get('/api', (req, res) => {
    res.json({
        message: 'ScaleFlow Task Tracker API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: {
                login: 'POST /api/auth/login',
                register: 'POST /api/auth/register',
                forgotPassword: 'POST /api/auth/forgot-password',
                resetPassword: 'POST /api/auth/reset-password',
                me: 'GET /api/auth/me'
            },
            tasks: {
                list: 'GET /api/tasks',
                create: 'POST /api/tasks',
                update: 'PUT /api/tasks/:id',
                delete: 'DELETE /api/tasks/:id',
                stats: 'GET /api/tasks/stats/dashboard'
            },
            admin: {
                users: 'GET /api/admin/users',
                createUser: 'POST /api/admin/users',
                updateUser: 'PUT /api/admin/users/:id',
                deleteUser: 'DELETE /api/admin/users/:id',
                stats: 'GET /api/admin/stats'
            }
        },
        health: 'GET /health'

    });
});

// ============ REGISTER ROUTES ============
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);

// ============ FRONTEND ROUTES ============
// Serve login page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'login.html'));
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(frontendPath, 'admin-dashboard.html'));
});

// Serve user dashboard
app.get('/developer', (req, res) => {
    res.sendFile(path.join(frontendPath, 'developer-dashboard.html'));
});

// Serve client dashboard
app.get('/client', (req, res) => {
    res.sendFile(path.join(frontendPath, 'client-dashboard.html'));
});

// ============ ERROR HANDLING ============
app.use(notFound);
app.use(errorHandler);

// ============ DATABASE CONNECTION ============
const PORT = process.env.PORT || 9040;

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB Connected!');
        console.log('Database:', mongoose.connection.name);
        app.listen(PORT, () => {
            console.log(`ScaleFlow Server running on http://localhost:${PORT}`);
            console.log(`Login Page: http://localhost:${PORT}/`);
            console.log(`Admin Dashboard: http://localhost:${PORT}/admin`);
            console.log(`User Dashboard: http://localhost:${PORT}/dashboard`);
            console.log(`Health Check: http://localhost:${PORT}/health`);
            console.log(`API Endpoint: http://localhost:${PORT}/api\n`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });