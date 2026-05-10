require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// User Schema
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: String,
    company: String,
    isActive: Boolean
});

const User = mongoose.model('User', userSchema);

// Email configuration
const sendEmail = async (to, subject, html, text) => {
    try {
        // Configure transporter
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: { rejectUnauthorized: false }
        });
        
        const mailOptions = {
            from: `"ScaleFlow Team" <${process.env.EMAIL_FROM || 'noreply@scaleflow.com'}>`,
            to: to,
            subject: subject,
            html: html,
            text: text
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`   📧 Email sent to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.log(`   ⚠️ Email failed to ${to}: ${error.message}`);
        return false;
    }
};

const seedDatabase = async () => {
    try {
        console.log('📦 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Clear existing users (keep only admins and developers)
        const deleted = await User.deleteMany({});
        console.log(`🗑️  Cleared ${deleted.deletedCount} existing users\n`);

        // Hash passwords
        const adminPass = await bcrypt.hash('admin123', 10);
        const devPass = await bcrypt.hash('dev123', 10);

        // Create Admin Users
        const adminUsers = [
            {
                name: 'Yavya Sharma',
                email: 'yavya@scaleflowsoftware.com',
                password: adminPass,
                role: 'admin',
                company: 'ScaleFlow Software',
                isActive: true
            },
            {
                name: 'Abhishek',
                email: 'abhishekji8055@gmail.com',
                password: adminPass,
                role: 'admin',
                company: 'ScaleFlow Software',
                isActive: true
            }
        ];

        // Create Developer Users
        const developerUsers = [
            {
                name: 'Yavya Sharma',
                email: 'Yavya.sharma21@gmail.com',
                password: devPass,
                role: 'developer',
                company: 'ScaleFlow Software',
                isActive: true
            },
        
            {
                name: 'Himanshu',
                email: 'himanshukar1810@gmail.com',
                password: devPass,
                role: 'developer',
                company: 'ScaleFlow Software',
                isActive: true
                
                
            }
        ];
        const allUsers = [...adminUsers, ...developerUsers];
        const users = await User.insertMany(allUsers);
        
        console.log('✅ Users created successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 LOGIN CREDENTIALS:\n');
        
        console.log('👑 ADMIN USERS:');
        adminUsers.forEach(user => {
            console.log(`   Email: ${user.email}`);
            console.log(`   Password: admin123`);
            console.log(`   Name: ${user.name}\n`);
        });
        
        console.log('💻 DEVELOPER USERS:');
        developerUsers.forEach(user => {
            console.log(`   Email: ${user.email}`);
            console.log(`   Password: dev123`);
            console.log(`   Name: ${user.name}\n`);
        });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Send welcome emails to all users
        console.log('📧 Sending welcome emails...\n');
        
        const loginUrl = 'https://task-tracker.scaleflowsoftware.com/login.html';
        
        for (const user of users) {
            const password = user.role === 'admin' ? 'admin123' : 'dev123';
            
            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .credentials { background: #f8fafc; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
                        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Welcome to ScaleFlow!</h2>
                        </div>
                        <div class="content">
                            <h3>Hello ${user.name},</h3>
                            <p>Your account has been created on ScaleFlow - Enterprise Task Management System.</p>
                            
                            <div class="credentials">
                                <h4>Your Account Details:</h4>
                                <p><strong>Email:</strong> ${user.email}</p>
                                <p><strong>Role:</strong> ${user.role.toUpperCase()}</p>
                                <p><strong>Password:</strong> <code>${password}</code></p>
                                <p><strong>Company:</strong> ${user.company}</p>
                            </div>
                            
                            <p>Click the button below to login:</p>
                            
                            <div style="text-align: center;">
                                <a href="${loginUrl}" class="btn">🔐 Login to ScaleFlow</a>
                            </div>
                            
                            <h4>What you can do:</h4>
                            <ul>
                                ${user.role === 'admin' ? `
                                    <li>View dashboard analytics</li>
                                    <li>Manage users and permissions</li>
                                    <li>Create and assign tasks</li>
                                    <li>Track project progress</li>
                                    <li>Monitor developer activity</li>
                                ` : `
                                    <li>View assigned tasks</li>
                                    <li>Update task status</li>
                                    <li>Add comments</li>
                                    <li>Track your progress</li>
                                    <li>Mark attendance</li>
                                `}
                            </ul>
                            
                            <hr>
                            <p style="font-size: 14px;">For security, please change your password after first login.</p>
                        </div>
                        <div class="footer">
                            <p>© 2025 ScaleFlow. All rights reserved.</p>
                            <p>Need help? Contact your system administrator.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            const emailText = `
                Welcome to ScaleFlow!
                
                Hello ${user.name},
                
                Your account has been created on ScaleFlow.
                
                Account Details:
                Email: ${user.email}
                Role: ${user.role.toUpperCase()}
                Password: ${password}
                Company: ${user.company}
                
                Login at: ${loginUrl}
                
                What you can do:
                ${user.role === 'admin' ? 
                    '- View dashboard analytics\n- Manage users\n- Create and assign tasks\n- Track project progress\n- Monitor developer activity' :
                    '- View assigned tasks\n- Update task status\n- Add comments\n- Track your progress\n- Mark attendance'}
                
                Best regards,
                ScaleFlow Team
            `;
            
            await sendEmail(
                user.email,
                `Welcome to ScaleFlow - ${user.role.toUpperCase()} Account Created`,
                emailHtml,
                emailText
            );
        }
        
        console.log('\n✅ All emails sent successfully!\n');

        // List all users
        console.log('📊 Users in database:');
        const finalUsers = await User.find({}).select('-password');
        finalUsers.forEach(user => {
            console.log(`   - ${user.name} (${user.email}) → ${user.role}`);
        });

        await mongoose.disconnect();
        console.log('\n🎉 Seeding complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

seedDatabase();