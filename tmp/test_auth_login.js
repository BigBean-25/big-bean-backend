const { login } = require('../src/controllers/authController');

const req = {
  body: { email: 'admin@bigbeancafe.in', password: 'admin123' }
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

login(req, res)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Login error:', err);
    process.exit(1);
  });
