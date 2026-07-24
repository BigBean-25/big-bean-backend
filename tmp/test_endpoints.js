const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 5000;
const BASE = `http://localhost:${PORT}`;

function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.end();
  });
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = async () => {
      try {
        const res = await request('/api/events/active');
        if (res.status < 500) return resolve();
      } catch (err) {
        if (Date.now() - start > 15000) return reject(new Error('Server did not start in time'));
      }
      setTimeout(tryConnect, 500);
    };
    tryConnect();
  });
}

async function main() {
  const server = spawn('node', [path.join(__dirname, '..', 'src', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  });

  try {
    await waitForServer();

    console.log('--- Testing /api/events/active ---');
    const active = await request('/api/events/active');
    console.log('Status:', active.status, 'Body:', JSON.stringify(active.body, null, 2));

    console.log('--- Testing /api/events/test-slug ---');
    const slug = await request('/api/events/test-slug');
    console.log('Status:', slug.status, 'Body:', JSON.stringify(slug.body, null, 2));

    console.log('--- Testing /api/admin/events without token ---');
    const admin = await request('/api/admin/events');
    console.log('Status:', admin.status, 'Body:', JSON.stringify(admin.body, null, 2));
  } catch (error) {
    console.error('Test error:', error.message);
    process.exitCode = 1;
  } finally {
    server.kill();
  }
}

main();
