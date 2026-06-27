const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'futureme_super_secret_matrix_key_123!';

module.exports = (req, res, next) => {
  let token = null;

  // 1. Check Authorization Header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Check Cookie
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const parts = cookie.split('=');
      acc[parts[0].trim()] = (parts[1] || '').trim();
      return acc;
    }, {});
    token = cookies['token'];
  }

  // If no token, deny access
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No session token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Session expired or invalid key matrix token.' });
  }
};
