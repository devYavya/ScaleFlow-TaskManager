
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

const seedDatabase = async () => {
    try {
        console.log('📦 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Clear existing users
        const deleted = await User.deleteMany({});
        console.log(`🗑️  Cleared ${deleted.deletedCount} existing users\n`);

        // Hash passwords
        const adminPass = await bcrypt.hash('admin123', 10);
        const clientPass = await bcrypt.hash('client123', 10);
        const devPass = await bcrypt.hash('dev123', 10);

        // Create users based on your requirements
        const users = await User.insertMany([
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
                email: 'abhishek@scaleflowsoftware.com',
                password: adminPass,
                role: 'admin',
                company: 'ScaleFlow Software',
                isActive: true
            },
            {
                name: 'Language Guru Client',
                email: 'admin@mylanguageguru.com',
                password: clientPass,
                role: 'client',
                company: 'My Language Guru',
                isActive: true
            },
            {
                name: 'Yavya Sharma (Developer)',
                email: 'Yavya.sharma21@gmail.com',
                password: devPass,
                role: 'developer',
                company: 'ScaleFlow Software',
                isActive: true
            }
        ]);

        console.log('✅ Users created successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 LOGIN CREDENTIALS:\n');
        
        console.log('👑 ADMIN USERS:');
        console.log('   1. Email: yavay@scaleflowsoftware.com');
        console.log('      Password: admin123');
        console.log('      Name: Yavya Sharma\n');
        console.log('   2. Email: abhishek@scaleflowsoftware.com');
        console.log('      Password: admin123');
        console.log('      Name: Abhishek\n');
        
        console.log('👤 CLIENT:');
        console.log('   Email: admin@mylanguageguru.com');
        console.log('   Password: client123');
        console.log('   Company: My Language Guru\n');
        
        console.log('💻 DEVELOPER:');
        console.log('   Email: Yavya.sharma21@gmail.com');
        console.log('   Password: dev123');
        console.log('   Name: Yavya Sharma (Developer)\n');
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // List all users
        console.log('📊 All users in database:');
        const allUsers = await User.find({}).select('-password');
        allUsers.forEach(user => {
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
