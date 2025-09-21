export default async function globalTeardown() {
  console.log('Tearing down test environment...');

  // If a mongo instance was started by the setup, stop it.
  if ((global as any).__MONGOINSTANCE) {
    console.log('Stopping MongoMemoryServer...');
    await (global as any).__MONGOINSTANCE.stop();
  }
}
