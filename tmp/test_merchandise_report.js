const { getMerchandiseOrdersReport } = require('../src/controllers/merchandiseOrderReportController');

const req = {
  admin: { id: 1, role_key: 'super_admin', is_super_admin: true },
  query: { date_filter_type: 'this_month' }
};

const res = {
  statusCode: 200,
  json(data) {
    console.log('Status:', this.statusCode);
    console.log(JSON.stringify({ summary: data.summary, data_count: (data.data || []).length }, null, 2));
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  }
};

getMerchandiseOrdersReport(req, res)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Report error:', err);
    process.exit(1);
  });
