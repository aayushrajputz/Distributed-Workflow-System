require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createDemoUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if demo user already exists
    const existingUser = await User.findOne({ email: 'demo@example.com' });
    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    // Create demo user (password will be hashed by the User model's pre-save hook)
    const demoUser = new User({
      username: 'demo',
      email: 'demo@example.com',
      password: 'Demo123!@#', // Don't hash here, let the model handle it
      firstName: 'Demo',
      lastName: 'User',
      isActive: true
    });

    await demoUser.save();
    console.log('Demo user created successfully!');
    console.log('Email: demo@example.com');
    console.log('Password: Demo123!@#');

  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createDemoUser();
