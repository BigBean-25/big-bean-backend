const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'bigbean_dev_secret_2024';

const customerAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Customer token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    if (decoded.type !== 'customer') return res.status(403).json({ success: false, message: 'Not a customer token' });
    req.customer = decoded;
    next();
  });
};

module.exports = { customerAuth };
