const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Get all logs summary
router.get('/summary', (req, res) => {
    const summary = logger.getLogSummary();
    res.json(summary);
});

// Get specific log file
router.get('/:logType', (req, res) => {
    const { logType } = req.params;
    const { lines = 100, offset = 0 } = req.query;

    const validLogs = ['access', 'error', 'activity', 'api', 'database'];

    if (!validLogs.includes(logType)) {
        return res.status(400).json({ error: 'Invalid log type' });
    }

    const logFile = path.join(__dirname, '../logs', `${logType}.log`);

    if (!fs.existsSync(logFile)) {
        return res.json({ logs: [], message: 'No logs found' });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const logLines = content.split('\n').filter(l => l.trim());
    const total = logLines.length;

    const start = Math.max(0, total - parseInt(lines) - parseInt(offset));
    const end = total - parseInt(offset);

    const requestedLines = logLines.slice(start, end);

    res.json({
        logType,
        total,
        linesReturned: requestedLines.length,
        logs: requestedLines
    });
});

// Clear logs
router.delete('/:logType', (req, res) => {
    const { logType } = req.params;

    const validLogs = ['access', 'error', 'activity', 'api', 'database'];

    if (!validLogs.includes(logType)) {
        return res.status(400).json({ error: 'Invalid log type' });
    }

    const logFile = path.join(__dirname, '../logs', `${logType}.log`);

    if (fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '', 'utf8');

        res.json({
            message: `Cleared ${logType} logs`
        });
    } else {
        res.json({
            message: 'No logs to clear'
        });
    }
});

// Download log file
router.get('/download/:logType', (req, res) => {
    const { logType } = req.params;

    const logFile = path.join(__dirname, '../logs', `${logType}.log`);

    if (!fs.existsSync(logFile)) {
        return res.status(404).json({
            error: 'Log file not found'
        });
    }

    res.download(logFile, `${logType}_${Date.now()}.log`);
});

module.exports = router;