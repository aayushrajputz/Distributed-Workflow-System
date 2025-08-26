const crypto = require('crypto');

// Generate a secure random API key secret
const apiKeySecret = crypto.randomBytes(32).toString('hex');

console.log('Generated API Key Secret:');
console.log(apiKeySecret);
console.log('\nAdd this to your .env file as:');
console.log(`API_KEY_SECRET=${apiKeySecret}`);
