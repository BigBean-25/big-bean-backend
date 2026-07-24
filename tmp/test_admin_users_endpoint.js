const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign(
  { id: 1, email: 'admin@bigbeancafe.in', type: 'admin', role_id: 1, role_key: 'super_admin' },
  process.env.JWT_SECRET || 'bigbean_secret_key_change_in_production',
  { expiresIn: '1h' }
);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/admin-users',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log(data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
  process.exit(1);
});

req.end();
