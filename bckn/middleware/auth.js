const jwt = require('jsonwebtoken');
const User = require('../models/user');

/**
 * Authenticate user using JWT token
 * This middleware checks if the user is logged in
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user (exclude password)
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                error: 'User not found. Invalid token.' 
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({ 
                error: 'Account is deactivated. Contact admin.' 
            });
        }

        // Attach user to request object
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        res.status(500).json({ error: 'Authentication failed.' });
    }
};

/**
 * Optional authentication (doesn't fail if no token)
 * Used for public routes that can optionally have user context
 */
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');
            if (user && user.isActive) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        // Don't fail if token is invalid, just continue without user
        next();
    }
};

module.exports = { authenticate, optionalAuth };