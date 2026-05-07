const logger = require('../utils/logger');

// Middleware to log all requests
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Capture original send
    const originalSend = res.send;
    let responseBody = null;
    
    res.send = function(body) {
        responseBody = body;
        originalSend.call(this, body);
    };
    
    // Log when response finishes
    res.on('finish', () => {
        const responseTime = Date.now() - start;
        
        // Log request
        logger.logRequest(req, res, responseTime);
        
        // Log API calls (only for API routes)
        if (req.url.startsWith('/api/')) {
            let body = null;
            try {
                if (req.body && Object.keys(req.body).length > 0) {
                    // Don't log passwords
                    const safeBody = { ...req.body };
                    if (safeBody.password) safeBody.password = '********';
                    body = safeBody;
                }
            } catch (e) {}
            
            let response = null;
            try {
                if (responseBody) {
                    response = JSON.parse(responseBody);
                    // Don't log tokens
                    if (response.token) response.token = '********';
                }
            } catch (e) {}
            
            logger.logAPI(req, body, response);
        }
    });
    
    next();
};

// Middleware to log user activity
const activityLogger = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
        // Log specific user actions
        if (req.user && req.method !== 'GET') {
            let action = '';
            let details = {};
            
            if (req.url.includes('/tasks') && req.method === 'POST') {
                action = 'CREATE_TASK';
                details = { title: req.body.title };
            } else if (req.url.includes('/tasks') && req.method === 'PUT') {
                action = 'UPDATE_TASK';
                details = { taskId: req.params.id, updates: req.body };
            } else if (req.url.includes('/admin/users') && req.method === 'POST') {
                action = 'CREATE_USER';
                details = { email: req.body.email, role: req.body.role };
            } else if (req.url.includes('/admin/users') && req.method === 'PUT') {
                action = 'UPDATE_USER';
                details = { userId: req.params.id };
            } else if (req.url.includes('/auth/login')) {
                action = 'LOGIN';
            } else if (req.url.includes('/auth/logout')) {
                action = 'LOGOUT';
            }
            
            if (action) {
                logger.logActivity(action, req.user, details);
            }
        }
        
        originalSend.call(this, body);
    };
    
    next();
};

module.exports = { requestLogger, activityLogger };
