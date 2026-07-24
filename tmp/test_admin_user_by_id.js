const { getAdminUserById } = require('../src/controllers/adminUserController');

const req = {
  admin: { id: 1, role_key: 'super_admin', is_super_admin: true },
  params: { id: '1' }
};

const res = {
  statusCode: 200,
  json(data) {
    console.log('Status:', this.statusCode);
    console.log(JSON.stringify(data, null, 2));
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  }
};

getAdminUserById(req, res)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Controller error:', err);
    process.exit(1);
  });
