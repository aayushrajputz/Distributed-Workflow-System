const crypto = require('crypto');

/**
 * Generates a new API key
 * @param {number} length - The length of the API key to generate
 * @returns {string} The generated API key
 */
const generateApiKey = (length = 32) => {
    return `wf_${crypto.randomBytes(length).toString('hex')}`;
};

/**
 * Hashes an API key for storage
 * @param {string} apiKey - The API key to hash
 * @param {string} secret - The secret key used for hashing
 * @returns {string} The hashed API key
 */
const hashApiKey = (apiKey, secret) => {
    return crypto
        .createHmac('sha256', secret)
        .update(apiKey)
        .digest('hex');
};

/**
 * Validates an API key against its hash
 * @param {string} apiKey - The API key to validate
 * @param {string} hashedKey - The stored hash to validate against
 * @param {string} secret - The secret key used for hashing
 * @returns {boolean} Whether the API key is valid
 */
const validateApiKey = (apiKey, hashedKey, secret) => {
    const computedHash = hashApiKey(apiKey, secret);
    return crypto.timingSafeEqual(
        Buffer.from(computedHash),
        Buffer.from(hashedKey)
    );
};

module.exports = {
    generateApiKey,
    hashApiKey,
    validateApiKey
};
