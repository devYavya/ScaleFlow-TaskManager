const fs = require('fs');
const path = require('path');

// Log directories
const LOG_DIR = path.join(__dirname, '../logs');
const ACCESS_LOG = path.join(LOG_DIR, 'access.log');
const ERROR_LOG = path.join(LOG_DIR, 'error.log');
const ACTIVITY_LOG = path.join(LOG_DIR, 'activity.log');
const API_LOG = path.join(LOG_DIR, 'api.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Get current timestamp
const getTimestamp = () => {
    return new Date().toISOString();
};

// Format log entry
const formatLogEntry = (level, message, data = null) => {
    const timestamp = getTimestamp();
    let logEntry = `[${timestamp}] [${level}] ${message}`;
    if (data) {
        logEntry += `\n${JSON.stringify(data, null, 2)}`;
    }
    return logEntry;
};

// Write to log file
const writeLog = (file, entry) => {
    fs.appendFileSync(file, entry + '\n', 'utf8');
};

// Log HTTP request
const logRequest = (req, res, responseTime) => {
    const logData = {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        timestamp: getTimestamp()
    };
    
    const logEntry = formatLogEntry('ACCESS', `${req.method} ${req.url}`, logData);
    writeLog(ACCESS_LOG, logEntry);
    
    // Also log to console with colors
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`${color}[${getTimestamp()}] ${req.method} ${req.url} - ${res.statusCode} (${responseTime}ms)\x1b[0m`);
};

// Log API activity
const logAPI = (req, body, response) => {
    const logData = {
        endpoint: req.url,
        method: req.method,
        requestBody: body,
        response: response,
        user: req.user ? { id: req.user._id, email: req.user.email, role: req.user.role } : null,
        timestamp: getTimestamp()
    };
    
    const logEntry = formatLogEntry('API', `${req.method} ${req.url}`, logData);
    writeLog(API_LOG, logEntry);
};

// Log activity (user actions)
const logActivity = (action, user, details) => {
    const logData = {
        action,
        user: user ? { id: user._id, email: user.email, role: user.role } : null,
        details,
        timestamp: getTimestamp()
    };
    
    const logEntry = formatLogEntry('ACTIVITY', `${action} by ${user?.email || 'Unknown'}`, logData);
    writeLog(ACTIVITY_LOG, logEntry);
    console.log(`\x1b[36m[ACTIVITY] ${action} - ${user?.email || 'Unknown'}\x1b[0m`);
};

// Log error
const logError = (error, req = null) => {
    const logData = {
        message: error.message,
        stack: error.stack,
        url: req?.url,
        method: req?.method,
        ip: req?.ip,
        timestamp: getTimestamp()
    };
    
    const logEntry = formatLogEntry('ERROR', error.message, logData);
    writeLog(ERROR_LOG, logEntry);
    console.error(`\x1b[31m[ERROR] ${error.message}\x1b[0m`);
};

// Log user login
const logLogin = (user, success, ip) => {
    const status = success ? 'SUCCESS' : 'FAILED';
    const logData = {
        email: user?.email,
        role: user?.role,
        ip,
        status,
        timestamp: getTimestamp()
    };
    
    const logEntry = formatLogEntry('AUTH', `Login ${status} for ${user?.email || 'unknown'}`, logData);
    writeLog(ACTIVITY_LOG, logEntry);
    console.log(`\x1b[35m[AUTH] Login ${status} - ${user?.email || 'unknown'} (${ip})\x1b[0m`);
};

// Log database operations
const logDatabase = (operation, model, query, duration) => {
    const logData = {
        operation,
        model,
        query,
        duration: `${duration}ms`,
        timestamp: getTimestamp()
    };
    
    const logEntry = formatLogEntry('DATABASE', `${operation} on ${model}`, logData);
    writeLog(path.join(LOG_DIR, 'database.log'), logEntry);
};

// Get log files summary
const getLogSummary = () => {
    const logs = {
        access: {},
        error: {},
        activity: {},
        api: {}
    };
    
    const files = ['access.log', 'error.log', 'activity.log', 'api.log'];
    
    files.forEach(file => {
        const filePath = path.join(LOG_DIR, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            
            logs[file.replace('.log', '')] = {
                size: `${(stats.size / 1024).toFixed(2)} KB`,
                lines: lines.length,
                lastModified: stats.mtime
            };
        }
    });
    
    return logs;
};

// Clear old logs (keep last 7 days)
const cleanOldLogs = () => {
    const files = fs.readdirSync(LOG_DIR);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
        const filePath = path.join(LOG_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old log file: ${file}`);
        }
    });
};

// Run log cleanup daily
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

module.exports = {
    logRequest,
    logAPI,
    logActivity,
    logError,
    logLogin,
    logDatabase,
    getLogSummary,
    cleanOldLogs
};
