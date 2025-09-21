import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  console.log('Setting up test environment...');

  // Set common test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

  // If not in a CI environment, start a local MongoDB instance.
  // In CI, we expect the MONGODB_URI to be provided by the workflow environment.
  if (!process.env.CI) {
    console.log('CI environment not detected, starting MongoMemoryServer...');
    const instance = await MongoMemoryServer.create();
    const uri = instance.getUri();
    (global as any).__MONGOINSTANCE = instance;
    // Set the MONGODB_URI for the tests to use
    process.env.MONGODB_URI = uri;
  } else {
    console.log('CI environment detected, using provided MONGODB_URI.');
  }
}
