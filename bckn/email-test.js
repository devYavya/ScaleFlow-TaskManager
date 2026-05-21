require('dotenv').config();
const axios = require('axios');

console.log('=================================');
console.log('📧 TESTING EMAIL CONFIGURATION');
console.log('=================================');

// Check environment variables
console.log('\n🔍 Environment Check:');
console.log('EMAIL_API exists:', !!process.env.EMAIL_API);
console.log('EMAIL_API length:', process.env.EMAIL_API?.length || 0);
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('EMAIL_FROM_NAME:', process.env.EMAIL_FROM_NAME);
console.log('NODE_ENV:', process.env.NODE_ENV);

if (!process.env.EMAIL_API) {
    console.error('\n❌ ERROR: EMAIL_API not found in .env file!');
    process.exit(1);
}

// Test Brevo API directly
const testBrevoAPI = async () => {
    console.log('\n📤 Sending test email to yourself...');
    
    try {
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: {
                    name: process.env.EMAIL_FROM_NAME || 'ScaleFlow Test',
                    email: process.env.EMAIL_FROM || 'noreply@scaleflowsoftware.com'
                },
                to: [{
                    email: 'scaleflowsoftware@gmail.com', // Your email
                    name: 'Test User'
                }],
                subject: 'Test Email from ScaleFlow',
                htmlContent: '<h1>Test Successful!</h1><p>If you see this, your Brevo API is working!</p>',
                textContent: 'Test Successful! Your Brevo API is working!'
            },
            {
                headers: {
                    'accept': 'application/json',
                    'api-key': process.env.EMAIL_API,
                    'content-type': 'application/json'
                }
            }
        );
        
        console.log('\n✅ SUCCESS! Email sent!');
        console.log('Message ID:', response.data.messageId);
        console.log('\n📧 Check your inbox at:', process.env.EMAIL_FROM);
        
    } catch (error) {
        console.error('\n❌ FAILED!');
        console.error('Error:', error.message);
        
        if (error.response) {
            console.error('\n📊 API Response Details:');
            console.error('Status:', error.response.status);
            console.error('Code:', error.response.data?.code);
            console.error('Message:', error.response.data?.message);
            
            if (error.response.data?.code === 'unauthorized') {
                console.error('\n💡 Solution: Your API key is invalid. Get a new one from Brevo dashboard.');
            } else if (error.response.data?.code === 'invalid_parameter') {
                console.error('\n💡 Solution: Your sender email needs to be verified in Brevo dashboard.');
                console.error('   1. Go to Brevo → SMTP & API → Senders & Domains');
                console.error('   2. Add and verify:', process.env.EMAIL_FROM);
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Solution: Check your internet connection.');
        } else if (error.code === 'ENOTFOUND') {
            console.error('\n💡 Solution: DNS lookup failed. Check your network.');
        }
    }
};

// Run the test
testBrevoAPI();