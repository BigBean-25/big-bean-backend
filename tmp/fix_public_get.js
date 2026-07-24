const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'src', 'routes');

const files = [
  'appPromoRoutes.js', 'blogRoutes.js', 'careerRoutes.js', 'contactRoutes.js',
  'corporateRoutes.js', 'dashboardRoutes.js', 'eventRoutes.js', 'franchiseRoutes.js',
  'galleryRoutes.js', 'menuRoutes.js', 'merchandiseBannerRoutes.js', 'merchandiseCategoryRoutes.js',
  'merchandiseRoutes.js', 'newsletterRoutes.js', 'offerRoutes.js', 'outletRoutes.js',
  'reservationRoutes.js', 'seoRoutes.js', 'adminCustomerRoutes.js', 'adminRoutes.js'
];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Remove verifyAdminToken, requirePermission from router.get lines
  const lines = content.split('\n');
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.match(/router\.get\s*\(/)) {
      // Remove middleware: router.get('/path', verifyAdminToken, requirePermission('module', 'view'), handler)
      // -> router.get('/path', handler)
      line = line.replace(/verifyAdminToken,\s*requirePermission\('[^']+',\s*'view'\),\s*/g, '');
    }
    newLines.push(line);
  }
  content = newLines.join('\n');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed public GET in ${file}`);
  } else {
    console.log(`No GET middleware to remove in ${file}`);
  }
}

console.log('Public GET routes restored');
