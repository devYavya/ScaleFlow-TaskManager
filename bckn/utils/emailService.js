const axios = require('axios');
require('dotenv').config();

// Brevo API configuration
const BREVO_API_KEY = process.env.EMAIL_API;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Get sender email
const getSenderEmail = () => {
    return process.env.EMAIL_FROM || 'noreply@scaleflowsoftware.com';
};

// Get sender name
const getSenderName = () => {
    return process.env.EMAIL_FROM_NAME || 'ScaleFlow Task Manager';
};

// Helper function to send email via Brevo HTTP API
const sendViaBrevoAPI = async (to, subject, htmlContent, textContent) => {
    if (!BREVO_API_KEY) {
        console.warn('Warning: EMAIL_API key not found. Emails will be logged to console only.');
        console.log(`\n========== EMAIL (Mock Mode) ==========`);
        console.log(`   To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   =========================================\n`);
        return { success: true, message: 'Mock mode - API key missing' };
    }

    try {
        const response = await axios.post(
            BREVO_API_URL,
            {
                sender: {
                    name: getSenderName(),
                    email: getSenderEmail()
                },
                to: [
                    {
                        email: to,
                        name: to.split('@')[0]
                    }
                ],
                subject: subject,
                htmlContent: htmlContent,
                textContent: textContent || htmlContent.replace(/<[^>]*>/g, '')
            },
            {
                headers: {
                    'accept': 'application/json',
                    'api-key': BREVO_API_KEY,
                    'content-type': 'application/json'
                },
                timeout: 30000
            }
        );

        console.log(`Email sent to ${to}: ${subject}`);
        console.log(`   Message ID: ${response.data.messageId}`);
        return { success: true, messageId: response.data.messageId };
    } catch (error) {
        console.error('Failed to send email via Brevo API:', error.response?.data?.message || error.message);
        
        if (error.response?.data?.code === 'unauthorized') {
            console.error('   Invalid API key. Please check your EMAIL_API environment variable.');
        } else if (error.response?.data?.code === 'invalid_parameter') {
            console.error('   Invalid parameter. Check sender email is verified in Brevo dashboard.');
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            console.error('   Connection timeout. Check your network/firewall settings.');
        }
        
        return { success: false, error: error.message };
    }
};

// Format role name for display
const formatRoleName = (role) => {
    const roleMap = {
        'admin': 'Administrator',
        'client': 'Client',
        'developer': 'Developer',
        'client-team': 'Team Member'
    };
    return roleMap[role] || role.toUpperCase();
};

// Send invitation email to new users
const sendInvitationEmail = async (email, name, tempPassword, role) => {
    const resetLink = `https://task-tracker.scaleflowsoftware.com/reset-password.html?email=${encodeURIComponent(email)}`;
    const formattedRole = formatRoleName(role);
    
    const htmlContent = `
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
                    <p>Enterprise Task Management Platform</p>
                </div>
                <div class="content">
                    <h2>Welcome to ScaleFlow, ${name}!</h2>
                    <p>You have been added as a <strong>${formattedRole}</strong> to ScaleFlow - our enterprise task management platform.</p>
                    
                    <div class="credentials">
                        <h3>Account Details:</h3>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Role:</strong> ${formattedRole}</p>
                        <p><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
                    </div>
                    
                    <p>Please click the button below to set up your password and activate your account:</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetLink}" class="btn">Activate Your Account</a>
                    </div>
                    
                    <p style="font-size: 14px; color: #64748b;">Or copy this link to your browser:</p>
                    <p style="background: #f1f5f9; padding: 10px; border-radius: 6px; word-break: break-all; font-size: 12px;">${resetLink}</p>
                    
                    <hr style="margin: 30px 0;">
                    
                    <h3>Getting Started with ScaleFlow:</h3>
                    <ul>
                        <li>Create and manage tasks efficiently</li>
                        <li>Collaborate with your team members</li>
                        <li>Track project progress in real-time</li>
                        <li>Update task status and add comments</li>
                        <li>Receive notifications for assignments</li>
                    </ul>
                </div>
                <div class="footer">
                    <p>This link will expire in 24 hours for security reasons.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>&copy; 2024 ScaleFlow. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const textContent = `Welcome to ScaleFlow!\n\nHello ${name},\n\nYou have been added as a ${formattedRole} to ScaleFlow.\n\nYour temporary password is: ${tempPassword}\n\nPlease reset your password at: ${resetLink}\n\nGetting Started:\n- Create and manage tasks\n- Collaborate with team members\n- Track project progress\n- Update task status\n\nBest regards,\nScaleFlow Team`;
    
    return await sendViaBrevoAPI(email, `Welcome to ScaleFlow - ${formattedRole} Account Created`, htmlContent, textContent);
};

// Send password reset email
const sendResetPasswordEmail = async (email, resetToken, name) => {
    const resetLink = `https://task-tracker.scaleflowsoftware.com/reset-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
    
    const htmlContent = `
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
                    <h2>Password Reset Request</h2>
                </div>
                <div class="content">
                    <h2>Hello, ${name}!</h2>
                    <p>We received a request to reset your password for your ScaleFlow account.</p>
                    
                    <div class="warning">
                        <p><strong>Security Note:</strong> If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
                    </div>
                    
                    <p>Click the button below to create a new password:</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetLink}" class="btn">Reset Password</a>
                    </div>
                    
                    <p style="font-size: 14px; color: #64748b;">Or copy this link to your browser:</p>
                    <p style="background: #f1f5f9; padding: 10px; border-radius: 6px; word-break: break-all; font-size: 12px;">${resetLink}</p>
                    
                    <hr style="margin: 30px 0;">
                    <p style="font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 ScaleFlow. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const textContent = `Password Reset Request\n\nHello ${name},\n\nReset your password at: ${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`;
    
    return await sendViaBrevoAPI(email, 'Reset Your Password - ScaleFlow', htmlContent, textContent);
};

// Send welcome email after successful password reset
const sendWelcomeEmail = async (email, name) => {
    const htmlContent = `
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
                    <h2>Welcome to ScaleFlow!</h2>
                </div>
                <div class="content">
                    <h2>Hello ${name}!</h2>
                    <p>Your account has been successfully activated. You can now log in to ScaleFlow and start managing your tasks.</p>
                    
                    <div style="text-align: center;">
                        <a href="https://task-tracker.scaleflowsoftware.com" class="btn">Go to ScaleFlow</a>
                    </div>
                    
                    <h3>What you can do:</h3>
                    <ul>
                        <li>Create and manage tasks</li>
                        <li>Collaborate with team members</li>
                        <li>Track your progress with analytics</li>
                        <li>Get real-time notifications</li>
                        <li>Add comments and reviews</li>
                    </ul>
                    
                    <hr style="margin: 30px 0;">
                    <p style="font-size: 14px;">Need help? Contact your administrator.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 ScaleFlow. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const textContent = `Welcome to ScaleFlow!\n\nHello ${name},\n\nYour account has been activated.\n\nLogin at: https://task-tracker.scaleflowsoftware.com\n\nWhat you can do:\n- Create and manage tasks\n- Collaborate with team members\n- Track your progress\n- Add comments and reviews\n\nBest regards,\nScaleFlow Team`;
    
    return await sendViaBrevoAPI(email, 'Welcome to ScaleFlow - Account Activated', htmlContent, textContent);
};

// Send task assignment notification
const sendTaskAssignmentEmail = async (email, name, taskTitle, assignedBy) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #667eea;">New Task Assigned</h2>
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
    `;
    
    const textContent = `New Task Assigned: ${taskTitle}\n\nHello ${name},\n\nYou have been assigned a new task by ${assignedBy}.\n\nLogin to view: https://task-tracker.scaleflowsoftware.com/developer`;
    
    return await sendViaBrevoAPI(email, `New Task Assigned: ${taskTitle}`, htmlContent, textContent);
};

// Generic email sender
const sendEmail = async (to, subject, html, text) => {
    return await sendViaBrevoAPI(to, subject, html, text);
};

// Send leave request email to admin
const sendLeaveRequestEmail = async (leave, developer) => {
    const startDate = new Date(leave.startDate).toLocaleDateString();
    const endDate = new Date(leave.endDate).toLocaleDateString();
    
    const htmlContent = `
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
    `;
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@scaleflow.com';
    return await sendViaBrevoAPI(adminEmail, `Leave Request - ${developer.name} (${leave.type})`, htmlContent);
};

// Send leave approval/rejection email to developer
const sendLeaveApprovalEmail = async (leave, developer, status, adminName) => {
    const startDate = new Date(leave.startDate).toLocaleDateString();
    const endDate = new Date(leave.endDate).toLocaleDateString();
    const isApproved = status === 'approved';
    
    const subject = `Leave Request ${isApproved ? 'Approved' : 'Rejected'} - ${leave.type}`;
    const color = isApproved ? '#10b981' : '#ef4444';
    const message = isApproved 
        ? 'Your leave request has been approved.'
        : 'Your leave request has been rejected.';
    
    const htmlContent = `
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
    `;
    
    return await sendViaBrevoAPI(developer.email, subject, htmlContent);
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