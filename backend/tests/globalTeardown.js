const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

const config = {
  stateFile: path.join(__dirname, '.test-state.json')
};

module.exports = async () => {
  // Read state from file
  if (!fs.existsSync(config.stateFile)) {
    console.warn('No test state file found');
    return;
  }

  const state = JSON.parse(fs.readFileSync(config.stateFile));

  // Close mongoose connection if open
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Stop MongoDB memory server
  if (state.mongoPid) {
    try {
      const server = new MongoMemoryServer({
        instance: {
          port: new URL(state.mongoUri).port
        }
      });
      await server.stop();
    } catch (err) {
      console.warn('Failed to stop MongoDB memory server:', err);
    }
  }

  // Clean up state file
  fs.unlinkSync(config.stateFile);
};