const axios = require('axios');

const BREVO_API_KEY = process.env.EMAIL_API;
const FROM_EMAIL = process.env.EMAIL_FROM;
const FROM_NAME = process.env.EMAIL_FROM_NAME;

const sendEmail = async (to, subject, htmlContent, textContent) => {
    if (!BREVO_API_KEY || !FROM_EMAIL) {
        console.log('📧 [MOCK] Email would be sent:', { to, subject });
        return { success: true, mock: true };
    }

    try {
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: { name: FROM_NAME, email: FROM_EMAIL },
                to: [{ email: to }],
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
                timeout: 10000
            }
        );
        
        console.log(`✅ Email sent to ${to}`);
        return { success: true, messageId: response.data.messageId };
    } catch (error) {
        console.error('❌ Email error:', error.response?.data?.message || error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail };