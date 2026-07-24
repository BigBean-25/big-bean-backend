const jwt = require('jsonwebtoken');
const http = require('http');
const fs = require('fs');
const path = require('path');

const token = jwt.sign(
  { id: 1, email: 'admin@bigbeancafe.in', type: 'admin', role_id: 1, role_key: 'super_admin' },
  process.env.JWT_SECRET || 'bigbean_secret_key_change_in_production',
  { expiresIn: '1h' }
);

const outputPath = path.join(__dirname, 'report_api.pdf');
const file = fs.createWriteStream(outputPath);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/merchandise-orders/report/pdf?date_filter_type=this_month',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('PDF saved:', outputPath, fs.statSync(outputPath).size, 'bytes');
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
  process.exit(1);
});

req.end();
