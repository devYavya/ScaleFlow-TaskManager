const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { sendResetPasswordEmail, sendWelcomeEmail } = require('../utils/emailService');

// @route   POST /api/auth/register
// @desc    Register new user (public - but usually admin only)
// @access  Public (or Private for admin only)
router.post('/register', validate.register, async (req, res, next) => {
    try {
        const { name, email, password, role, company } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }
        
        // Create user
        const user = new User({ name, email, password, role, company });
        await user.save();
        
        // Send welcome email
        await sendWelcomeEmail(email, name);
        
        // Generate token
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );
        
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validate.login, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check if active
        if (!user.isActive) {
            return res.status(401).json({ error: 'Account is deactivated. Contact admin.' });
        }
        
        // Generate token
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal that user doesn't exist for security
            return res.json({ 
                message: 'If an account exists, a reset link will be sent' 
            });
        }
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
        await user.save();
        
        // Send email
        await sendResetPasswordEmail(email, resetToken, user.name);
        
        res.json({ 
            message: 'Password reset instructions sent to your email' 
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', validate.resetPassword, async (req, res, next) => {
    try {
        const { email, token, newPassword } = req.body;
        
        const user = await User.findOne({
            email,
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ 
                error: 'Invalid or expired reset token' 
            });
        }
        
        // Update password
        user.password = newPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        
        res.json({ 
            success: true,
            message: 'Password reset successful. You can now login.' 
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', authenticate, async (req, res) => {
    res.json({
        user: req.user
    });
});

// @route   POST /api/auth/logout
// @desc    Logout user (client side token removal, but we can blacklist)
// @access  Private
router.post('/logout', authenticate, async (req, res) => {
    // In a more advanced setup, you'd blacklist the token
    // For now, client just removes token from storage
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;