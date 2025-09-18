const mongoose = require('mongoose');
require('dotenv').config();

// Test MongoDB connection
async function testMongoDBConnection() {
  try {
    console.log('🔄 Testing MongoDB connection...');
    console.log('📍 Connection string:', process.env.MONGODB_URI ? 'Found' : 'Missing');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB connection successful!');
    console.log('📊 Connection details:');
    console.log('   - Database:', mongoose.connection.db.databaseName);
    console.log('   - Host:', mongoose.connection.host);
    console.log('   - Port:', mongoose.connection.port);
    console.log('   - Ready State:', mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected');

    // Test basic operations
    console.log('\n🧪 Testing basic database operations...');
    
    // Create a test collection and document
    const TestModel = mongoose.model('Test', new mongoose.Schema({
      message: String,
      timestamp: { type: Date, default: Date.now }
    }));

    // Insert test document
    const testDoc = await TestModel.create({
      message: 'MongoDB connection test successful'
    });
    console.log('✅ Test document created:', testDoc._id);

    // Read test document
    const foundDoc = await TestModel.findById(testDoc._id);
    console.log('✅ Test document retrieved:', foundDoc.message);

    // Update test document
    await TestModel.findByIdAndUpdate(testDoc._id, { message: 'Updated test message' });
    console.log('✅ Test document updated');

    // Delete test document
    await TestModel.findByIdAndDelete(testDoc._id);
    console.log('✅ Test document deleted');

    // Clean up test collection
    await TestModel.collection.drop();
    console.log('✅ Test collection cleaned up');

    console.log('\n🎉 All MongoDB operations completed successfully!');

  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   Error:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('   💡 Suggestion: Check your username and password in the connection string');
    } else if (error.message.includes('network')) {
      console.error('   💡 Suggestion: Check your internet connection and MongoDB Atlas network access');
    } else if (error.message.includes('timeout')) {
      console.error('   💡 Suggestion: Check if your IP address is whitelisted in MongoDB Atlas');
    }
    
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Run the test
testMongoDBConnection();