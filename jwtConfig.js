// jwtConfig.js
require('dotenv').config();

const secretkey = process.env.JWT_SECRET;

if (!secretkey) {
  // Fail fast so you never sign/verify with "undefined"
  throw new Error('Missing JWT_SECRET in environment. Add it to your .env file.');
}

module.exports = { secretkey };
