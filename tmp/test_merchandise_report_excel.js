const fs = require('fs');
const path = require('path');
const { getMerchandiseOrdersReportExcel } = require('../src/controllers/merchandiseOrderReportController');

const outputPath = path.join(__dirname, 'report_test.xlsx');
const res = fs.createWriteStream(outputPath);
res.setHeader = () => {};
res.status = () => res;

const req = {
  admin: { id: 1, role_key: 'super_admin', is_super_admin: true },
  query: { date_filter_type: 'this_month' }
};

getMerchandiseOrdersReportExcel(req, res)
  .then(() => {
    res.on('finish', () => {
      console.log('Excel generated:', outputPath, fs.statSync(outputPath).size, 'bytes');
      process.exit(0);
    });
    res.on('error', (err) => {
      console.error('Excel stream error:', err);
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('Excel generation error:', err);
    process.exit(1);
  });
