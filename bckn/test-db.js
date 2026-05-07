const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Successfully connected to MongoDB Atlas!');
        console.log(' Database:', mongoose.connection.name);
        console.log('Host:', mongoose.connection.host);
        
        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        
        await mongoose.disconnect();
        console.log('Disconnected');
    } catch (error) {
        console.error('Connection failed:', error.message);
        console.log('\n Troubleshooting:');
        console.log('1. Check your password in MONGODB_URI');
        console.log('2. Verify IP whitelist (Network Access)');
        console.log('3. Check cluster is deployed (Database -> Clusters)');
    }
};

testConnection();