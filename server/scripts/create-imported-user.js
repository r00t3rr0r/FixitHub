// create-imported-user.js
// Script to create a user without a password for password reset testing

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';

async function main() {
  await mongoose.connect(DATABASE_URL);
  const email = 'dieter.senf@protonmail.com';

  // Remove if already exists
  await User.deleteOne({ email });

  const user = new User({
    email,
    password: undefined, // No password set
    firstName: 'Dieter',
    lastName: 'Senf',
    name: 'Dieter Senf',
    role: 'customer',
    isActive: true,
    status: 'active',
    // Add other fields as needed
  });
  await user.save();
  console.log('User created without password:', user.email, user._id);
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
