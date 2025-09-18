const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

const config = {
  stateFile: path.join(__dirname, '.test-state.json')
};

module.exports = async () => {
  // Start MongoDB Memory Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Save connection info to file for teardown
  const state = {
    mongoUri,
    mongoPid: mongoServer.childProcess.pid
  };
  
  fs.writeFileSync(config.stateFile, JSON.stringify(state));

  // Make mongo URI available globally
  process.env.MONGO_URI = mongoUri;
};