// utils/jwtutils.js
const jwt = require('jsonwebtoken');
const { secretkey } = require('../jwtConfig');

/**
 * Accepts either a full user object or a payload.
 * Ensures { id, email, role } are set in the token.
 */
function generateToken(userOrPayload = {}) {
  const id =
    userOrPayload._id?.toString?.() ||
    userOrPayload.id ||
    userOrPayload.userId;

  const payload = {
    id,
    email: userOrPayload.email,
    role: userOrPayload.role || 'user',
  };

  return jwt.sign(payload, secretkey, { expiresIn: '24h' });
}

module.exports = { generateToken };
