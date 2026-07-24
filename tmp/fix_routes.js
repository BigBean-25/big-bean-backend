const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'src', 'routes');

// Module key mapping per route filename
const moduleKeyMap = {
  'homeBannerRoutes.js': 'home_banners',
  'aboutHeroRoutes.js': 'about_hero',
  'menuHeroRoutes.js': 'menu_hero',
  'offersHeroRoutes.js': 'offers_hero',
  'outletHeroRoutes.js': 'outlet_hero',
  'reservationHeroRoutes.js': 'reservation_hero',
  'careerHeroRoutes.js': 'career_hero',
  'corporateHeroRoutes.js': 'corporate_hero',
  'franchiseHeroRoutes.js': 'franchise_hero',
  'galleryHeroRoutes.js': 'gallery_hero',
  'blogHeroRoutes.js': 'blog_hero',
  'contactHeroRoutes.js': 'contact_hero',
  'legalPageRoutes.js': 'legal_pages',
  'seoPagesRoutes.js': 'seo_pages',
  'seoRoutes.js': 'seo',
  'settingRoutes.js': 'settings',
  'siteSettingsRoutes.js': 'site_settings',
  'careerJobRoutes.js': 'career_jobs',
  'careerApplicationRoutes.js': 'career_applications',
  'blogPostRoutes.js': 'blog_posts',
  'blogRoutes.js': 'blog_posts',
  'menuComboRoutes.js': 'menu_combos',
  'menuRoutes.js': 'menu_items',
  'merchandiseReviewRoutes.js': 'merchandise_reviews',
  'instagramMediaRoutes.js': 'instagram_media',
  'merchandiseRoutes.js': 'merchandise',
  'merchandiseCategoryRoutes.js': 'merchandise_categories',
  'merchandiseBannerRoutes.js': 'merchandise_banners',
  'merchandiseOrderRoutes.js': 'merchandise_orders',
  'eventRoutes.js': 'events',
  'offerRoutes.js': 'offers',
  'appPromoRoutes.js': 'app_promos',
  'galleryRoutes.js': 'gallery',
  'galleryItemRoutes.js': 'gallery',
  'testimonialRoutes.js': 'testimonials',
  'newsletterRoutes.js': 'newsletter_subscribers',
  'franchiseRoutes.js': 'franchise_enquiries',
  'corporateRoutes.js': 'corporate_enquiries',
  'contactRoutes.js': 'contact_enquiries',
  'contactEnquiryRoutes.js': 'contact_enquiries',
  'corporateEnquiryRoutes.js': 'corporate_enquiries',
  'franchiseEnquiryRoutes.js': 'franchise_enquiries',
  'adminUserRoutes.js': 'admin_users',
  'adminRoleRoutes.js': 'roles_permissions',
  'adminPermissionRoutes.js': 'roles_permissions',
  'adminRoutes.js': 'admin_users',
  'adminSupportRoutes.js': 'support_tickets',
  'adminNotificationRoutes.js': 'notifications',
  'adminCustomerRoutes.js': 'customers',
  'dashboardRoutes.js': 'dashboard',
  'reservationRoutes.js': 'reservations',
  'outletRoutes.js': 'outlets',
  'paymentRoutes.js': 'settings',
};

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  const moduleKey = moduleKeyMap[file];
  if (!moduleKey) {
    console.log(`Skipping ${file}: no module mapping`);
    continue;
  }

  // Skip if already uses verifyAdminToken and requirePermission everywhere
  const hasRequireRole = /requireRole\(/.test(content);
  const hasRequirePermission = /requirePermission\(/.test(content);
  const hasAuthenticateToken = /authenticateToken/.test(content);

  if (!hasRequireRole && !hasAuthenticateToken && hasRequirePermission) {
    console.log(`Skipping ${file}: already uses requirePermission`);
    continue;
  }

  // Replace import: requireRole -> requirePermission, authenticateToken -> verifyAdminToken
  if (content.includes('requireRole')) {
    content = content.replace(/requireRole/g, 'requirePermission');
  }
  if (content.includes('authenticateToken')) {
    content = content.replace(/authenticateToken/g, 'verifyAdminToken');
  }

  // Replace adminRoles const if present
  content = content.replace(/const adminRoles = \[[^\]]+\];\s*/g, '');
  content = content.replace(/const adminRoles=\[[^\]]+\];\s*/g, '');

  // Replace requirePermission(adminRoles) with requirePermission('module_key', 'action')
  // Handle GET, POST, PUT, DELETE, PATCH
  content = content.replace(/requirePermission\(adminRoles\)/g, `requirePermission('${moduleKey}', 'view')`);

  // Replace specific method-based requireRole calls if they exist
  // router.get('/path', requireRole(...), ...) -> requirePermission('module', 'view')
  content = content.replace(/requirePermission\(\['admin',\s*'manager',\s*'super_admin'\]\)/g, `requirePermission('${moduleKey}', 'view')`);
  content = content.replace(/requirePermission\(\['super_admin',\s*'admin'\]\)/g, `requirePermission('${moduleKey}', 'view')`);
  content = content.replace(/requirePermission\(\['admin',\s*'super_admin'\]\)/g, `requirePermission('${moduleKey}', 'view')`);

  // Map methods to actions
  content = content.replace(/(router\.(get)\([^)]*,\s*)requirePermission\('([^']+)',\s*'view'\)/g, (match, p1, p2, p3) => {
    return `${p1}requirePermission('${p3}', 'view')`;
  });
  content = content.replace(/(router\.(post)\([^)]*,\s*)requirePermission\('([^']+)',\s*'view'\)/g, (match, p1, p2, p3) => {
    return `${p1}requirePermission('${p3}', 'create')`;
  });
  content = content.replace(/(router\.(put|patch)\([^)]*,\s*)requirePermission\('([^']+)',\s*'view'\)/g, (match, p1, p2, p3) => {
    return `${p1}requirePermission('${p3}', 'edit')`;
  });
  content = content.replace(/(router\.(delete)\([^)]*,\s*)requirePermission\('([^']+)',\s*'view'\)/g, (match, p1, p2, p3) => {
    return `${p1}requirePermission('${p3}', 'delete')`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${file}`);
  } else {
    console.log(`No changes for ${file}`);
  }
}

console.log('Route fix done');
