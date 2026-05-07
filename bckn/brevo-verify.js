require('dotenv').config();
const nodemailer = require('nodemailer');

const verifyBrevoConnection = async () => {
    console.log('🔍 Verifying Brevo Connection...\n');
    
    // Check if API keys are set
    console.log('📋 Environment Variables Check:');
    console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Missing'}`);
    console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing'}`);
    console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM ? '✅ Set' : '❌ Missing'}`);
    console.log('');
    
    if (!process.env.EMAIL_USER && !process.env.EMAIL_PASS) {
        console.log('❌ No Brevo credentials found. Please add to .env file');
        console.log('\nAdd these to your .env file:');
        console.log('EMAIL_USER=your_email_here');
        console.log('EMAIL_PASS=your_password_here');
        console.log('EMAIL_FROM=noreply@yourdomain.com');
        return;
    }
    
    // Test SMTP connection
    console.log('📧 Testing SMTP Connection...');
    
    const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER || 'noreply@taskflow.com',
            pass: process.env.EMAIL_PASS || process.env.EMAIL_PASS
        }
    });
    
    try {
        // Verify connection
        await transporter.verify();
        console.log('✅ SMTP Connection Successful!\n');
        
        // Send a test email
        console.log('📧 Sending test email...');
        
        const testResult = await transporter.sendMail({
            from: `"TaskFlow Test" <${process.env.EMAIL_FROM || 'noreply@taskflow.com'}>`,
            to: process.env.EMAIL_FROM || 'test@example.com',
            subject: 'Brevo Connection Test - TaskFlow',
            html: `
                <h2>✅ Brevo Connection Successful!</h2>
                <p>Your TaskFlow application is successfully connected to Brevo.</p>
                <p>Time: ${new Date().toLocaleString()}</p>
                <p>This is a test email to verify the integration.</p>
            `,
            text: `Brevo Connection Test\n\nYour TaskFlow application is successfully connected to Brevo.\nTime: ${new Date().toLocaleString()}`
        });
        
        console.log('✅ Test email sent!');
        console.log(`   Message ID: ${testResult.messageId}`);
        console.log(`   To: ${process.env.EMAIL_FROM || 'test@example.com'}`);
        console.log('\n📊 Check your Brevo dashboard to see the email!');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.log('\n💡 Troubleshooting:');
        console.log('1. Check your API key is correct');
        console.log('2. Verify your Brevo account is active');
        console.log('3. Check if you have sufficient credits');
    }
};

verifyBrevoConnection();
