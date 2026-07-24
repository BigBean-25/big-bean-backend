const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'src', 'routes');

const publicSubmissions = {
  'contactRoutes.js': [
    { method: 'post', path: '/' },
  ],
  'franchiseRoutes.js': [
    { method: 'post', path: '/' },
  ],
  'corporateRoutes.js': [
    { method: 'post', path: '/' },
  ],
  'careerRoutes.js': [
    { method: 'post', path: '/apply' },
    { method: 'post', path: '/submit' },
    { method: 'post', path: '/' },
  ],
  'appPromoRoutes.js': [
    { method: 'get', path: '/active' },
    { method: 'get', path: '/public' },
  ],
  'blogRoutes.js': [
    { method: 'get', path: '/' },
    { method: 'get', path: '/active' },
    { method: 'get', path: '/:slug' },
  ],
  'eventRoutes.js': [
    { method: 'get', path: '/' },
    { method: 'get', path: '/active' },
    { method: 'get', path: '/:id' },
  ],
  'galleryRoutes.js': [
    { method: 'get', path: '/' },
    { method: 'get', path: '/active' },
  ],
  'outletRoutes.js': [
    { method: 'get', path: '/' },
    { method: 'get', path: '/active' },
    { method: 'get', path: '/:slug' },
  ],
  'seoRoutes.js': [
    { method: 'get', path: '/' },
    { method: 'get', path: '/public' },
  ],
  'dashboardRoutes.js': [
    { method: 'get', path: '/' },
  ],
  'adminCustomerRoutes.js': [
    { method: 'post', path: '/' },
  ],
};

for (const [file, publics] of Object.entries(publicSubmissions)) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  for (const p of publics) {
    const method = p.method;
    const pathRegex = p.path.replace(/:([a-zA-Z0-9_]+)/g, ':[a-zA-Z0-9_]+');
    const pattern = new RegExp(`router\\.${method}\\('${pathRegex}'\\s*,\\s*verifyAdminToken,\\s*requirePermission\\('[^']+',\\s*'[^']+'\\),\\s*`, 'i');
    content = content.replace(pattern, `router.${method}('${p.path}', `);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed public submissions in ${file}`);
  } else {
    console.log(`No public submission fixes in ${file}`);
  }
}

console.log('Public submission routes fixed');
