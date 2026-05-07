const nodemailer = require('nodemailer');
require('dotenv').config();

// Configure Brevo SMTP transporter
let transporter = null;

// Initialize Brevo transporter
const initTransporter = () => {
    if (transporter) return transporter;
    
    const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.EMAIL_PORT) || 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    
    if (!user || !pass) {
        console.warn('⚠️ Email credentials not found. Emails will be logged to console only.');
        console.warn('   Please set EMAIL_USER and EMAIL_PASS in .env file');
        return null;
    }
    
    // Configure Brevo SMTP
    transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: false, // TLS for port 587
        auth: {
            user: user,
            pass: pass
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
    });
    
    console.log('📧 Brevo email service initialized');
    console.log(`   SMTP Host: ${host}:${port}`);
    console.log(`   SMTP User: ${user}`);
    
    return transporter;
};

// Get sender email
const getSenderEmail = () => {
    return process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@scaleflow.com';
};

// Get sender name
const getSenderName = () => {
    return process.env.EMAIL_FROM_NAME || 'ScaleFlow Task Manager';
};

// Send invitation email to new users
const sendInvitationEmail = async (email, name, tempPassword, role) => {
    try {
        const transporter = initTransporter();
        const senderEmail = getSenderEmail();
        const senderName = getSenderName();
        
        if (!transporter) {
            // Mock mode - just log
            console.log('\n📧 ========== EMAIL (Mock Mode) ==========');
            console.log(`   To: ${email}`);
            console.log(`   Name: ${name}`);
            console.log(`   Role: ${role}`);
            console.log(`   Temp Password: ${tempPassword}`);
            console.log('   =========================================\n');
            return { success: true, message: 'Mock mode - email not sent' };
        }
        
        const resetLink = `https://task-tracker.scaleflowsoftware.com/reset-password.html?email=${encodeURIComponent(email)}`;
        
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: email,
            subject: `Welcome to ScaleFlow - ${role} account created`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 15px 15px 0 0; }
                        .content { background: #ffffff; padding: 30px; border-radius: 0 0 15px 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .credentials { background: #f8fafc; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 8px; }
                        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #94a3b8; }
                        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                        .logo span { color: #667eea; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">Scale<span>Flow</span></div>
                            <p>Enterprise Task Management</p>
                        </div>
                        <div class="content">
                            <h2>Welcome to ScaleFlow, ${name}! 👋</h2>
                            <p>You have been added as a <strong>${role.toUpperCase()}</strong> to ScaleFlow - our enterprise task management platform.</p>
                            
                            <div class="credentials">
                                <h3>🔐 Your Account Details:</h3>
                                <p><strong>📧 Email:</strong> ${email}</p>
                                <p><strong>👤 Role:</strong> ${role}</p>
                                <p><strong>🔑 Temporary Password:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
                            </div>
                            
                            <p>Please click the button below to set up your password and activate your account:</p>
                            
                            <div style="text-align: center;">
                                <a href="${resetLink}" class="btn">🚀 Activate Your Account</a>
                            </div>
                            
                            <p style="font-size: 14px; color: #64748b;">Or copy this link to your browser:</p>
                            <p style="background: #f1f5f9; padding: 10px; border-radius: 6px; word-break: break-all; font-size: 12px;">${resetLink}</p>
                            
                            <hr style="margin: 30px 0;">
                            
                            <h3>✨ Getting Started with ScaleFlow:</h3>
                            <ul>
                                <li>📋 Create and manage tasks efficiently</li>
                                <li>👥 Collaborate with your team members</li>
                                <li>📊 Track project progress in real-time</li>
                                <li>✅ Update task status and add comments</li>
                                <li>📧 Receive notifications for assignments</li>
                            </ul>
                        </div>
                        <div class="footer">
                            <p>This link will expire in 24 hours for security reasons.</p>
                            <p>If you didn't request this, please ignore this email.</p>
                            <p>© 2024 ScaleFlow. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Welcome to ScaleFlow!\n\nHello ${name},\n\nYou have been added as a ${role} to ScaleFlow.\n\nYour temporary password is: ${tempPassword}\n\nPlease reset your password at: ${resetLink}\n\nGetting Started:\n- Create and manage tasks\n- Collaborate with team members\n- Track project progress\n- Update task status\n\nBest regards,\nScaleFlow Team`
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Invitation email sent to ${email}`);
        if (info.messageId) {
            console.log(`   Message ID: ${info.messageId}`);
        }
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Failed to send invitation email:', error.message);
        if (error.message.includes('sender') || error.message.includes('from')) {
            console.log('\n💡 Brevo Sender Verification Required:');
            console.log('   1. Go to Brevo Dashboard → SMTP & API → Senders & Domains');
            console.log('   2. Add and verify your sender email: ' + getSenderEmail());
            console.log('   3. Or update EMAIL_FROM in .env file\n');
        }
        return { success: false, error: error.message };
    }
};

// Send password reset email
const sendResetPasswordEmail = async (email, resetToken, name) => {
    try {
        const transporter = initTransporter();
        const senderEmail = getSenderEmail();
        const senderName = getSenderName();
        
        if (!transporter) {
            console.log(`\n📧 [MOCK] Password reset email to ${email} with token ${resetToken}\n`);
            return { success: true, message: 'Mock mode' };
        }
        
        const resetLink = `https://task-tracker.scaleflowsoftware.com/reset-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
        
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: email,
            subject: 'Reset Your Password - ScaleFlow',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 15px 15px 0 0; }
                        .content { background: #ffffff; padding: 30px; border-radius: 0 0 15px 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 8px; }
                        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #94a3b8; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>🔐 Password Reset Request</h2>
                        </div>
                        <div class="content">
                            <h2>Hello, ${name}!</h2>
                            <p>We received a request to reset your password for your ScaleFlow account.</p>
                            
                            <div class="warning">
                                <p>⚠️ <strong>Security Note:</strong> If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
                            </div>
                            
                            <p>Click the button below to create a new password:</p>
                            
                            <div style="text-align: center;">
                                <a href="${resetLink}" class="btn">🔄 Reset Password</a>
                            </div>
                            
                            <p style="font-size: 14px; color: #64748b;">Or copy this link to your browser:</p>
                            <p style="background: #f1f5f9; padding: 10px; border-radius: 6px; word-break: break-all; font-size: 12px;">${resetLink}</p>
                            
                            <hr style="margin: 30px 0;">
                            <p style="font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
                        </div>
                        <div class="footer">
                            <p>© 2024 ScaleFlow. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Password Reset Request\n\nHello ${name},\n\nReset your password at: ${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${email}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Failed to send reset email:', error.message);
        return { success: false, error: error.message };
    }
};

// Send welcome email after successful password reset
const sendWelcomeEmail = async (email, name) => {
    try {
        const transporter = initTransporter();
        const senderEmail = getSenderEmail();
        const senderName = getSenderName();
        
        if (!transporter) {
            console.log(`📧 [MOCK] Welcome email to ${email}\n`);
            return { success: true };
        }
        
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: email,
            subject: 'Welcome to ScaleFlow - Account Activated',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 15px 15px 0 0; }
                        .content { background: #ffffff; padding: 30px; border-radius: 0 0 15px 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #94a3b8; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>🎉 Welcome to ScaleFlow!</h2>
                        </div>
                        <div class="content">
                            <h2>Hello ${name}!</h2>
                            <p>Your account has been successfully activated. You can now log in to ScaleFlow and start managing your tasks.</p>
                            
                            <div style="text-align: center;">
                                <a href="https://task-tracker.scaleflowsoftware.com" class="btn">🚀 Go to ScaleFlow</a>
                            </div>
                            
                            <h3>✨ What you can do:</h3>
                            <ul>
                                <li>✅ Create and manage tasks</li>
                                <li>👥 Collaborate with team members</li>
                                <li>📊 Track your progress with analytics</li>
                                <li>🔔 Get real-time notifications</li>
                                <li>💬 Add comments and reviews</li>
                            </ul>
                            
                            <hr style="margin: 30px 0;">
                            <p style="font-size: 14px;">Need help? Contact your administrator.</p>
                        </div>
                        <div class="footer">
                            <p>© 2024 ScaleFlow. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Welcome to ScaleFlow!\n\nHello ${name},\n\nYour account has been activated.\n\nLogin at: https://task-tracker.scaleflowsoftware.com\n\nWhat you can do:\n- Create and manage tasks\n- Collaborate with team members\n- Track your progress\n- Add comments and reviews\n\nBest regards,\nScaleFlow Team`
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Welcome email sent to ${email}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Failed to send welcome email:', error.message);
        return { success: false, error: error.message };
    }
};

// Send task assignment notification
const sendTaskAssignmentEmail = async (email, name, taskTitle, assignedBy) => {
    try {
        const transporter = initTransporter();
        const senderEmail = getSenderEmail();
        const senderName = getSenderName();
        
        if (!transporter) {
            console.log(`📧 [MOCK] Task assignment email to ${email}: ${taskTitle}\n`);
            return { success: true };
        }
        
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: email,
            subject: `New Task Assigned: ${taskTitle}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #667eea;">📋 New Task Assigned</h2>
                    <p>Hello ${name},</p>
                    <p>You have been assigned a new task by <strong>${assignedBy}</strong>.</p>
                    <div style="background: linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0;">Task: ${taskTitle}</h3>
                    </div>
                    <a href="https://task-tracker.scaleflowsoftware.com/developer" 
                       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                        View Task
                    </a>
                </div>
            `,
            text: `New Task Assigned: ${taskTitle}\n\nHello ${name},\n\nYou have been assigned a new task by ${assignedBy}.\n\nLogin to view: https://task-tracker.scaleflowsoftware.com/developer`
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Task assignment email sent to ${email}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Failed to send task email:', error.message);
        return { success: false, error: error.message };
    }
};

// Generic email sender
const sendEmail = async (to, subject, html, text) => {
    try {
        const transporter = initTransporter();
        const senderEmail = getSenderEmail();
        const senderName = getSenderName();
        
        if (!transporter) {
            console.log(`📧 [MOCK] Email to: ${to} - Subject: ${subject}`);
            return { success: true };
        }
        
        const info = await transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to,
            subject,
            html,
            text
        });
        
        console.log(`✅ Email sent to ${to}: ${subject}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        return { success: false, error: error.message };
    }
};
// Send leave request email to admin
const sendLeaveRequestEmail = async (leave, developer) => {
    try {
        const transporter = initTransporter();
        const senderEmail = getSenderEmail();
        const senderName = getSenderName();
        
        const startDate = new Date(leave.startDate).toLocaleDateString();
        const endDate = new Date(leave.endDate).toLocaleDateString();
        
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: process.env.ADMIN_EMAIL || 'admin@scaleflow.com',
            subject: `Leave Request - ${developer.name} (${leave.type})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <h2 style="color: #6366f1;">New Leave Request</h2>
                    <p><strong>Developer:</strong> ${developer.name} (${developer.email})</p>
                    <p><strong>Leave Type:</strong> ${leave.type}</p>
                    <p><strong>Dates:</strong> ${startDate} to ${endDate}</p>
                    <p><strong>Reason:</strong> ${leave.reason}</p>
                    <p><strong>Applied On:</strong> ${new Date(leave.appliedOn).toLocaleString()}</p>
                    <hr>
                    <a href="https://task-tracker.scaleflowsoftware.com/admin" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Request</a>
                </div>
            `
        };
        
        if (transporter) {
            await transporter.sendMail(mailOptions);
            console.log(`📧 Leave request email sent to admin for ${developer.name}`);
        } else {
            console.log(`📧 [MOCK] Leave request email would be sent to admin for ${developer.name}`);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Failed to send leave request email:', error.message);
        return { success: false };
    }
};

// Send leave approval/rejection email to developer
const sendLeaveApprovalEmail = async (leave, developer, status, adminName) => {
    try {
        const transporter = initTransporter();
        const senderEmail = getSenderEmail();
        const senderName = getSenderName();
        
        const startDate = new Date(leave.startDate).toLocaleDateString();
        const endDate = new Date(leave.endDate).toLocaleDateString();
        const isApproved = status === 'approved';
        
        const subject = `Leave Request ${isApproved ? 'Approved' : 'Rejected'} - ${leave.type}`;
        const color = isApproved ? '#10b981' : '#ef4444';
        const message = isApproved 
            ? 'Your leave request has been approved.'
            : 'Your leave request has been rejected.';
        
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: developer.email,
            subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <h2 style="color: ${color};">Leave Request ${isApproved ? 'Approved' : 'Rejected'}</h2>
                    <p>Dear ${developer.name},</p>
                    <p>${message}</p>
                    <p><strong>Leave Type:</strong> ${leave.type}</p>
                    <p><strong>Dates:</strong> ${startDate} to ${endDate}</p>
                    <p><strong>Reason:</strong> ${leave.reason}</p>
                    ${leave.adminComments ? `<p><strong>Admin Comments:</strong> ${leave.adminComments}</p>` : ''}
                    <p><strong>Reviewed by:</strong> ${adminName}</p>
                    <p><strong>Reviewed on:</strong> ${new Date(leave.approvedAt).toLocaleString()}</p>
                    <hr>
                    <a href="https://task-tracker.scaleflowsoftware.com/developer" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
                </div>
            `
        };
        
        if (transporter) {
            await transporter.sendMail(mailOptions);
            console.log(`📧 Leave ${status} email sent to ${developer.email}`);
        } else {
            console.log(`📧 [MOCK] Leave ${status} email would be sent to ${developer.email}`);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Failed to send leave approval email:', error.message);
        return { success: false };
    }
};

module.exports = {
    sendInvitationEmail,
    sendResetPasswordEmail,
    sendWelcomeEmail,
    sendTaskAssignmentEmail,
    sendEmail,
    sendLeaveRequestEmail,
    sendLeaveApprovalEmail
};