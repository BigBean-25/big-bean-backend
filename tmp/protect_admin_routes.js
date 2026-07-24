const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'src', 'routes');

const moduleKeyMap = {
  'appPromoRoutes.js': 'app_promos',
  'blogRoutes.js': 'blog_posts',
  'careerRoutes.js': 'career_jobs',
  'contactRoutes.js': 'contact_enquiries',
  'corporateRoutes.js': 'corporate_enquiries',
  'dashboardRoutes.js': 'dashboard',
  'eventRoutes.js': 'events',
  'franchiseRoutes.js': 'franchise_enquiries',
  'galleryRoutes.js': 'gallery',
  'menuRoutes.js': 'menu_items',
  'merchandiseBannerRoutes.js': 'merchandise_banners',
  'merchandiseCategoryRoutes.js': 'merchandise_categories',
  'merchandiseRoutes.js': 'merchandise',
  'newsletterRoutes.js': 'newsletter_subscribers',
  'offerRoutes.js': 'offers',
  'outletRoutes.js': 'outlets',
  'reservationRoutes.js': 'reservations',
  'seoRoutes.js': 'seo',
  'adminCustomerRoutes.js': 'customers',
  'adminRoutes.js': 'admin_users',
};

const publicGetPatterns = [
  "/'\\/active'/",
  "/'\\/public'/",
  "/'\\/public-config'/",
  "/'\\/slug\\/:slug'/",
  "/'\\/categories'/",
  "/'\\/products\\//",
  "/'\\/product\\//",
  "/'\\/by-path'/",
  "/'\\/page\\/:pageKey'/"
];

for (const file of Object.keys(moduleKeyMap)) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file}: not found`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const moduleKey = moduleKeyMap[file];

  // Skip if already has any middleware
  if (content.match(/verifyAdminToken|authenticateToken|requirePermission|requireRole/)) {
    console.log(`Skipping ${file}: already has middleware`);
    continue;
  }

  // Add import
  if (!content.includes('authMiddleware')) {
    const lastRequire = content.lastIndexOf('require(');
    const lastRequireLineEnd = content.indexOf('\n', lastRequire);
    content = content.slice(0, lastRequireLineEnd + 1) +
      `const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');\n` +
      content.slice(lastRequireLineEnd + 1);
  }

  // Add protection to non-GET routes and GET routes without known public path
  // We process each router line
  const lines = content.split('\n');
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]*)['"]/);
    if (match) {
      const indent = match[1];
      const method = match[2];
      const route = match[3];
      const action = method === 'get' ? 'view' : method === 'post' ? 'create' : method === 'put' || method === 'patch' ? 'edit' : 'delete';
      // Determine if public GET
      let isPublicGet = false;
      if (method === 'get') {
        if (['', 'active', 'public', 'public-config', 'by-path', 'categories', 'products', 'product'].includes(route) ||
            route.startsWith('slug/') || route.startsWith('page/') || route.startsWith('products/') || route.startsWith('product/')) {
          isPublicGet = true;
        }
      }
      // Get the handler/function line - but easier to insert middleware in current line
      if (!isPublicGet) {
        // Insert middleware before the handler argument
        const lineMatch = line.match(/^(\s*router\.(get|post|put|delete|patch)\s*\(\s*['"][^'"]*['"],\s*)/);
        if (lineMatch) {
          const newLine = line.replace(lineMatch[1], `${lineMatch[1]}verifyAdminToken, requirePermission('${moduleKey}', '${action}'), `);
          newLines.push(newLine);
          continue;
        }
      }
    }
    newLines.push(line);
  }
  content = newLines.join('\n');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Protected ${file}`);
  } else {
    console.log(`No changes for ${file}`);
  }
}

console.log('Admin route protection done');
