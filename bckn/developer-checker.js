
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const checkDeveloper = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const developerEmail = 'Yavya.sharma21@gmail.com';
        const developer = await User.findOne({ email: developerEmail });
        
        if (!developer) {
            console.log(`❌ Developer not found: ${developerEmail}`);
            console.log('\n📝 Creating developer account...');
            
            const hashedPassword = await bcrypt.hash('dev123', 10);
            const newDeveloper = new User({
                name: 'Yavya Sharma (Developer)',
                email: developerEmail,
                password: hashedPassword,
                role: 'developer',
                company: 'ScaleFlow Software',
                isActive: true
            });
            await newDeveloper.save();
            console.log('✅ Developer account created!');
            console.log('   Email: Yavya.sharma21@gmail.com');
            console.log('   Password: dev123');
        } else {
            console.log(`✅ Developer found: ${developer.email}`);
            console.log(`   Name: ${developer.name}`);
            console.log(`   Role: ${developer.role}`);
            console.log(`   Status: ${developer.isActive ? 'Active' : 'Inactive'}`);
            console.log(`   Password hash: ${developer.password.substring(0, 50)}...`);
            
            // Test password
            const testPassword = 'dev123';
            const isMatch = await bcrypt.compare(testPassword, developer.password);
            console.log(`\n🔐 Password 'dev123' match: ${isMatch ? '✅ YES' : '❌ NO'}`);
            
            if (!isMatch) {
                console.log('\n🔄 Password mismatch! Fixing...');
                const newHash = await bcrypt.hash(testPassword, 10);
                developer.password = newHash;
                await developer.save();
                console.log('✅ Password fixed! Try login again.');
            }
        }
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
    }
};

checkDeveloper();