const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    const adminUsers = await User.find({ role: 'admin' }).select('email role').lean();
    const staffUsers = await User.find({ role: 'staff' }).select('email role').lean();
    
    console.log('👑 Admin users:', adminUsers.length);
    adminUsers.forEach(u => console.log(`   • ${u.email}`));
    
    console.log('\n👥 Staff users:', staffUsers.length);
    staffUsers.forEach(u => console.log(`   • ${u.email}`));
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();
