require('dotenv').config();
const mongoose = require('mongoose');

const diagnose = async () => {
    console.log('🔍 DIAGNOSTIC INFO:\n');
    
    console.log('1. Environment:');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   PORT:', process.env.PORT);
    console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
    
    if (process.env.MONGODB_URI) {
        console.log('   URI length:', process.env.MONGODB_URI.length);
        console.log('   URI prefix:', process.env.MONGODB_URI.substring(0, 30) + '...');
        
        // Try to connect with 10 second timeout
        console.log('\n2. Attempting connection...');
        
        const options = {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 10000,
        };
        
        try {
            await mongoose.connect(process.env.MONGODB_URI, options);
            console.log('   ✅ CONNECTION SUCCESSFUL!');
            console.log('   Database:', mongoose.connection.name);
            console.log('   Host:', mongoose.connection.host);
            await mongoose.disconnect();
        } catch (err) {
            console.log('   ❌ CONNECTION FAILED');
            console.log('   Error:', err.message);
            
            if (err.message.includes('bad auth')) {
                console.log('\n   🔧 FIX: Wrong username or password');
                console.log('   Go to Atlas → Database Access → Edit user');
            } else if (err.message.includes('ENOTFOUND')) {
                console.log('\n   🔧 FIX: Wrong cluster address');
                console.log('   Check cluster name in Atlas → Database');
            } else if (err.message.includes('whitelist')) {
                console.log('\n   🔧 FIX: IP not whitelisted');
                console.log('   Go to Atlas → Network Access → Add IP');
            }
        }
    }
    
    console.log('\n3. Complete .env file content (with password hidden):');
    const envContent = require('fs').readFileSync('.env', 'utf8');
    console.log(envContent.replace(/LIv7mSH2YYUjTF4X/g, '***HIDDEN***'));
};

diagnose();