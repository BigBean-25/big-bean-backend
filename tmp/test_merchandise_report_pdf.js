const fs = require('fs');
const path = require('path');
const { getMerchandiseOrdersReportPdf } = require('../src/controllers/merchandiseOrderReportController');

const outputPath = path.join(__dirname, 'report_test.pdf');
const res = fs.createWriteStream(outputPath);
res.setHeader = () => {};
res.status = () => res;

const req = {
  admin: { id: 1, role_key: 'super_admin', is_super_admin: true },
  query: { date_filter_type: 'this_month' }
};

getMerchandiseOrdersReportPdf(req, res)
  .then(() => {
    res.on('finish', () => {
      console.log('PDF generated:', outputPath, fs.statSync(outputPath).size, 'bytes');
      process.exit(0);
    });
    res.on('error', (err) => {
      console.error('PDF stream error:', err);
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('PDF generation error:', err);
    process.exit(1);
  });
