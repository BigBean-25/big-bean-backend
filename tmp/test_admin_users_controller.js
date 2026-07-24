const { getAllAdminUsers } = require('../src/controllers/adminUserController');

// Mock super-admin request
const req = {
  admin: { id: 1, role_key: 'super_admin', is_super_admin: true },
  query: {}
};

const res = {
  statusCode: 200,
  json(data) {
    console.log('Response status:', this.statusCode);
    console.log('Response body:', JSON.stringify(data, null, 2));
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  }
};

getAllAdminUsers(req, res)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Controller error:', err);
    process.exit(1);
  });
