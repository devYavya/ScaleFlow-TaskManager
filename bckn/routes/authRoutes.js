const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// Mock email service for now
const sendMockEmail = (to, subject, body) => {
    console.log('\n📧 ========== EMAIL ==========');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${body}`);
    console.log('   ============================\n');
};

// @route   POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, role, company } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const user = new User({ name, email, password, role, company });
        await user.save();
        
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
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
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        console.log('Login attempt:', email);
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        if (!user.isActive) {
            return res.status(401).json({ error: 'Account deactivated. Contact admin.' });
        }
        
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
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
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ message: 'If account exists, reset link will be sent' });
        }
        
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
        await user.save();
        
        const resetLink = `https://scaleflow-taskmanager.onrender.com/reset-password.html?token=${resetToken}&email=${email}`;
        sendMockEmail(email, 'Reset Your Password', `Click here to reset: ${resetLink}`);
        
        res.json({ message: 'Password reset instructions sent to your email' });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
    try {
        const { email, token, newPassword } = req.body;
        
        const user = await User.findOne({
            email,
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        
        user.password = newPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        
        sendMockEmail(email, 'Password Reset Successful', 'Your password has been reset successfully!');
        
        res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/setup-account
// @desc    Setup account for new users (first time password set)
router.post('/setup-account', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user already has a password set (not temporary)
        // You can add a flag like isFirstLogin, but for now just update password
        user.password = password;
        user.isActive = true;
        await user.save();
        
        // Send welcome email
        sendMockEmail(email, 'Welcome to ScaleFlow', `Your account has been activated! Login at: https://scaleflow-taskmanager.onrender.com/login.html`);
        
        // Generate token for auto-login
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: 'Account setup successfully',
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
        console.error('Setup account error:', error);
        res.status(500).json({ error: error.message });
    }
});

// @route   GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    res.json({ user: req.user });
});

// @route   POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
