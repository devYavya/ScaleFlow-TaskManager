const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { sendResetPasswordEmail, sendWelcomeEmail } = require('../utils/emailService');

const sendMockEmail = (to, subject, body) => {
    console.log('\n📧 ========== EMAIL ==========');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${body}`);
    console.log('   ============================\n');
};

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

router.post('/forgot-password', async (req, res) => {
    console.log('🔵 FORGOT PASSWORD REQUEST RECEIVED');
    console.log('📧 Email:', req.body.email);
    
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        const user = await User.findOne({ email });
        console.log('🔍 User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('⚠️ User not found, but returning success for security');
            return res.status(200).json({ 
                message: 'If an account exists with this email, you will receive reset instructions.' 
            });
        }
        
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000;
        
        user.resetToken = resetToken;
        user.resetTokenExpiry = resetTokenExpiry;
        await user.save();
        
        console.log('✅ Reset token generated and saved');
        
        console.log('📧 Attempting to send reset email to:', email);
        const emailResult = await sendResetPasswordEmail(email, resetToken, user.name);
        
        console.log('📧 Email send result:', emailResult);
        
        if (!emailResult.success) {
            console.error('❌ Failed to send reset email:', emailResult.error);
            return res.status(500).json({ 
                error: 'Failed to send reset email. Please try again later.' 
            });
        }
        
        res.status(200).json({ 
            message: 'Password reset instructions have been sent to your email.' 
        });
        
    } catch (error) {
        console.error('🔴 Forgot password error:', error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

router.post('/reset-password', async (req, res) => {
    console.log('🔵 RESET PASSWORD REQUEST RECEIVED');
    
    try {
        const { token, email, newPassword } = req.body;
        
        if (!token || !email || !newPassword) {
            return res.status(400).json({ error: 'Token, email, and new password are required' });
        }
        
        const user = await User.findOne({
            email: email,
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
        
        console.log('✅ Password reset successful for:', email);
        
        try {
            await sendWelcomeEmail(email, user.name);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }
        
        res.status(200).json({ 
            message: 'Password has been reset successfully. You can now login with your new password.' 
        });
        
    } catch (error) {
        console.error('🔴 Reset password error:', error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

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
        
        user.password = password;
        user.isActive = true;
        await user.save();
        
        sendMockEmail(email, 'Welcome to ScaleFlow', `Your account has been activated! Login at: https://scaleflow-taskmanager.onrender.com/login.html`);
        
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

router.get('/me', authenticate, async (req, res) => {
    res.json({ user: req.user });
});

router.post('/logout', authenticate, async (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;