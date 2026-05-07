const brevo = require('@getbrevo/brevo');

let apiInstance = null;

const initAPI = () => {
    if (apiInstance) return apiInstance;
    
    apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.EMAIL_API);
    return apiInstance;
};

const sendEmailViaAPI = async (to, subject, htmlContent, textContent) => {
    try {
        const api = initAPI();
        const sendSmtpEmail = {
            to: [{ email: to }],
            sender: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME },
            subject: subject,
            htmlContent: htmlContent,
            textContent: textContent
        };
        
        const data = await api.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ Email sent via Brevo API: ${data.messageId}`);
        return { success: true, messageId: data.messageId };
    } catch (error) {
        console.error('❌ Brevo API error:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmailViaAPI };
