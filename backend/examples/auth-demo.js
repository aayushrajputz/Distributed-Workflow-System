/**
 * Authentication System Demo
 *
 * This script demonstrates the enhanced User Authentication module
 * with all security best practices implemented.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { generateToken, verifyToken } = require('../config/jwt');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for demo');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const demonstrateAuth = async () => {
  console.log('\n🔐 User Authentication System Demo\n');

  try {
    // Clean up any existing demo user
    await User.deleteOne({ email: 'demo@example.com' });

    // 1. User Registration
    console.log('1️⃣ User Registration Demo');
    console.log('Creating user with strong password...');

    const userData = {
      username: 'demouser',
      email: 'demo@example.com',
      password: 'SecurePass123!',
      firstName: 'Demo',
      lastName: 'User',
    };

    const user = await User.create(userData);
    console.log('✅ User created successfully');
    console.log('📋 User data (password automatically excluded):');
    console.log(JSON.stringify(user.toJSON(), null, 2));

    // 2. Password Security Demo
    console.log('\n2️⃣ Password Security Demo');
    console.log('Original password:', userData.password);

    // Fetch user with password to show it's hashed
    const userWithPassword = await User.findById(user._id).select('+password');
    console.log('Hashed password in database:', userWithPassword.password);
    console.log('✅ Password is securely hashed with bcrypt (salt rounds: 12)');

    // 3. Password Comparison
    console.log('\n3️⃣ Password Verification Demo');
    const isValidPassword = await user.comparePassword('SecurePass123!');
    const isInvalidPassword = await user.comparePassword('wrongpassword');
    console.log('Valid password check:', isValidPassword ? '✅ Correct' : '❌ Wrong');
    console.log('Invalid password check:', isInvalidPassword ? '✅ Correct' : '❌ Wrong');

    // 4. JWT Token Generation
    console.log('\n4️⃣ JWT Token Demo');
    const token = generateToken({ userId: user._id });
    console.log('Generated JWT token:', token);

    // 5. JWT Token Verification
    console.log('\n5️⃣ JWT Token Verification Demo');
    try {
      const decoded = verifyToken(token);
      console.log('✅ Token verified successfully');
      console.log('Decoded payload:', decoded);
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
    }

    // 6. Account Lockout Demo
    console.log('\n6️⃣ Account Lockout Demo');
    console.log('Simulating failed login attempts...');

    // Simulate 5 failed attempts
    for (let i = 1; i <= 5; i++) {
      await user.incLoginAttempts();
      console.log(`Failed attempt ${i}/5`);
    }

    // Check if account is locked
    const lockedUser = await User.findById(user._id).select('+lockUntil +loginAttempts');
    console.log('Account locked:', lockedUser.isLocked ? '🔒 Yes' : '🔓 No');
    console.log('Login attempts:', lockedUser.loginAttempts);

    if (lockedUser.lockUntil) {
      console.log('Locked until:', new Date(lockedUser.lockUntil));
    }

    // 7. Reset Login Attempts
    console.log('\n7️⃣ Reset Login Attempts Demo');
    await user.resetLoginAttempts();
    const resetUser = await User.findById(user._id).select('+lockUntil +loginAttempts');
    console.log('✅ Login attempts reset');
    console.log('Account locked:', resetUser.isLocked ? '🔒 Yes' : '🔓 No');

    // 8. Security Features Summary
    console.log('\n8️⃣ Security Features Summary');
    console.log('✅ Password hashing with bcrypt (12 salt rounds)');
    console.log('✅ Strong password validation (8+ chars, uppercase, lowercase, number, special char)');
    console.log('✅ JWT token-based authentication');
    console.log('✅ Account lockout after 5 failed attempts (2-hour lock)');
    console.log('✅ Password field excluded from queries by default');
    console.log('✅ Sensitive fields removed from JSON output');
    console.log('✅ Email uniqueness validation');
    console.log('✅ Username uniqueness validation');
    console.log('✅ Account activation status checking');
    console.log('✅ Comprehensive input validation');
    console.log('✅ Detailed error codes for different auth failures');

    // 9. API Endpoints Available
    console.log('\n9️⃣ Available API Endpoints');
    console.log('POST /api/auth/register - Register new user');
    console.log('POST /api/auth/login - Login user');
    console.log('GET /api/auth/me - Get current user profile (requires auth)');

    // 10. Example API Usage
    console.log('\n🔟 Example API Usage');
    console.log(`
// Register User
POST /api/auth/register
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Login User
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

// Get Profile (with Authorization header)
GET /api/auth/me
Authorization: Bearer <jwt-token>
    `);

    console.log('\n🎉 Authentication Demo Complete!');
  } catch (error) {
    console.error('❌ Demo error:', error.message);
  } finally {
    // Clean up
    await User.deleteOne({ email: 'demo@example.com' });
    mongoose.connection.close();
  }
};

const runDemo = async () => {
  await connectDB();
  await demonstrateAuth();
};

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = { demonstrateAuth };
