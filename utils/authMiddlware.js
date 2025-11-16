// utils/authmiddleware.js
const jwt = require('jsonwebtoken');
const { secretkey } = require('../jwtConfig');

function authenticateToken(req, res, next) {
  const header = req.headers['authorization'] || req.header('Authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  jwt.verify(token, secretkey, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user; // { id, email, role }
    next();
  });
}

// Compatibility alias in case other files import the old misspelled name
module.exports = { authenticateToken, auth: authenticateToken, authanticateToken: authenticateToken };
