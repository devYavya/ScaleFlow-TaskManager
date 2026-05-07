const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;
let lastEmailTime = 0;
const emailQueue = [];

// Initialize Brevo transporter with better settings
const initTransporter = () => {
    if (transporter) return transporter;
    
    const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.EMAIL_PORT) || 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    
    if (!user || !pass) {
        console.warn('⚠️ Email credentials not found. Emails will be logged to console only.');
        return null;
    }
    
    transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: false,
        auth: { user: user, pass: pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        // Don't use pool for Render
        pool: false,
        rateLimit: 5,
        maxConnections: 1
    });
    
    // Verify connection on startup (don't await)
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ Brevo SMTP verification failed:', error.message);
        } else {
            console.log('✅ Brevo email service verified');
        }
    });
    
    console.log('📧 Brevo email service initialized');
    return transporter;
};

const getSenderEmail = () => {
    return process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@scaleflow.com';
};

const getSenderName = () => {
    return process.env.EMAIL_FROM_NAME || 'ScaleFlow Task Manager';
};

// Queue email for sending (to prevent rate limiting)
const queueEmail = async (sendFunction) => {
    const now = Date.now();
    const timeSinceLast = now - lastEmailTime;
    
    if (timeSinceLast < 2000) { // Wait 2 seconds between emails
        await new Promise(resolve => setTimeout(resolve, 2000 - timeSinceLast));
    }
    
    lastEmailTime = Date.now();
    return await sendFunction();
};

// Send invitation email
const sendInvitationEmail = async (email, name, tempPassword, role) => {
    const send = async () => {
        try {
            const transporter = initTransporter();
            const senderEmail = getSenderEmail();
            const senderName = getSenderName();
            
            if (!transporter) {
                console.log('\n📧 ========== EMAIL (Mock Mode) ==========');
                console.log(`   To: ${email}`);
                console.log(`   Name: ${name}`);
                console.log(`   Role: ${role}`);
                console.log(`   Temp Password: ${tempPassword}`);
                console.log('   =========================================\n');
                return { success: true, message: 'Mock mode - email not sent' };
            }
            
            const resetLink = `https://scaleflow-taskmanager.onrender.com/reset-password.html?email=${encodeURIComponent(email)}`;
            
            const mailOptions = {
                from: `"${senderName}" <${senderEmail}>`,
                to: email,
                subject: `Welcome to ScaleFlow - ${role} account created`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px;">
                        <h2 style="color: #6366f1;">Welcome to ScaleFlow!</h2>
                        <p>Hello <strong>${name}</strong>,</p>
                        <p>You have been added as a <strong>${role.toUpperCase()}</strong> to ScaleFlow.</p>
                        <div style="background: #f0f0ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Role:</strong> ${role}</p>
                            <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
                        </div>
                        <a href="${resetLink}" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Activate Account</a>
                        <p><small>This link expires in 24 hours.</small></p>
                    </div>
                `,
                text: `Welcome to ScaleFlow!\n\nHello ${name},\n\nYou have been added as a ${role}.\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nActivate at: ${resetLink}`
            };
            
            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ Invitation email sent to ${email}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Failed to send invitation email:', error.message);
            return { success: false, error: error.message };
        }
    };
    
    return await queueEmail(send);
};

// Send password reset email
const sendResetPasswordEmail = async (email, resetToken, name) => {
    const send = async () => {
        try {
            const transporter = initTransporter();
            
            if (!transporter) {
                console.log(`\n📧 [MOCK] Password reset email to ${email}\n`);
                return { success: true };
            }
            
            const resetLink = `https://scaleflow-taskmanager.onrender.com/reset-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
            
            const mailOptions = {
                from: `"${getSenderName()}" <${getSenderEmail()}>`,
                to: email,
                subject: 'Reset Your Password - ScaleFlow',
                html: `<h2>Reset Password</h2><a href="${resetLink}">Click here to reset your password</a><p>This link expires in 1 hour.</p>`,
                text: `Reset your password at: ${resetLink}`
            };
            
            await transporter.sendMail(mailOptions);
            console.log(`✅ Password reset email sent to ${email}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to send reset email:', error.message);
            return { success: false };
        }
    };
    
    return await queueEmail(send);
};

// Send welcome email
const sendWelcomeEmail = async (email, name) => {
    const send = async () => {
        try {
            const transporter = initTransporter();
            
            if (!transporter) {
                console.log(`📧 [MOCK] Welcome email to ${email}`);
                return { success: true };
            }
            
            const mailOptions = {
                from: `"${getSenderName()}" <${getSenderEmail()}>`,
                to: email,
                subject: 'Welcome to ScaleFlow - Account Activated',
                html: `<h2>Welcome ${name}!</h2><p>Your account has been activated. Login at: https://scaleflow-taskmanager.onrender.com</p>`
            };
            
            await transporter.sendMail(mailOptions);
            console.log(`✅ Welcome email sent to ${email}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to send welcome email:', error.message);
            return { success: false };
        }
    };
    
    return await queueEmail(send);
};

// Task assignment email
const sendTaskAssignmentEmail = async (email, name, taskTitle, assignedBy) => {
    console.log(`📧 Task assignment notification for ${name}: ${taskTitle}`);
    return { success: true };
};

// Leave request email
const sendLeaveRequestEmail = async (leave, developer) => {
    console.log(`📧 Leave request from ${developer.name}`);
    return { success: true };
};

// Leave approval email
const sendLeaveApprovalEmail = async (leave, developer, status, adminName) => {
    console.log(`📧 Leave ${status} for ${developer.name}`);
    return { success: true };
};

// Generic email sender
const sendEmail = async (to, subject, html, text) => {
    const send = async () => {
        try {
            const transporter = initTransporter();
            if (!transporter) {
                console.log(`📧 [MOCK] Email to: ${to}`);
                return { success: true };
            }
            
            const info = await transporter.sendMail({
                from: `"${getSenderName()}" <${getSenderEmail()}>`,
                to,
                subject,
                html,
                text
            });
            
            console.log(`✅ Email sent to ${to}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Failed to send email:', error.message);
            return { success: false };
        }
    };
    
    return await queueEmail(send);
};

module.exports = {
    sendInvitationEmail,
    sendResetPasswordEmail,
    sendWelcomeEmail,
    sendTaskAssignmentEmail,
    sendLeaveRequestEmail,
    sendLeaveApprovalEmail,
    sendEmail
};
