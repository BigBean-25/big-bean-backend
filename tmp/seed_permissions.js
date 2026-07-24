const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Arul2001',
    database: 'bigbean_cafe'
  });

  const requiredModules = [
    { key: 'dashboard', name: 'Dashboard', group: 'core' },
    { key: 'notifications', name: 'Notifications', group: 'core' },
    { key: 'reports', name: 'Reports', group: 'core' },
    { key: 'settings', name: 'Settings', group: 'core' },
    { key: 'site_settings', name: 'Site Settings', group: 'core' },
    { key: 'admin_users', name: 'Admin Users', group: 'core' },
    { key: 'roles_permissions', name: 'Roles & Permissions', group: 'core' },
    { key: 'customers', name: 'Customers', group: 'core' },
    { key: 'home_banners', name: 'Home Banners', group: 'content' },
    { key: 'about_hero', name: 'About Hero', group: 'content' },
    { key: 'menu_hero', name: 'Menu Hero', group: 'content' },
    { key: 'offers_hero', name: 'Offers Hero', group: 'content' },
    { key: 'outlet_hero', name: 'Outlet Hero', group: 'content' },
    { key: 'reservation_hero', name: 'Reservation Hero', group: 'content' },
    { key: 'career_hero', name: 'Career Hero', group: 'content' },
    { key: 'corporate_hero', name: 'Corporate Hero', group: 'content' },
    { key: 'franchise_hero', name: 'Franchise Hero', group: 'content' },
    { key: 'gallery_hero', name: 'Gallery Hero', group: 'content' },
    { key: 'blog_hero', name: 'Blog Hero', group: 'content' },
    { key: 'menu_items', name: 'Menu Items', group: 'menu' },
    { key: 'menu_combos', name: 'Menu Combos', group: 'menu' },
    { key: 'categories', name: 'Categories', group: 'menu' },
    { key: 'merchandise', name: 'Merchandise', group: 'merchandise' },
    { key: 'merchandise_categories', name: 'Merchandise Categories', group: 'merchandise' },
    { key: 'merchandise_banners', name: 'Merchandise Banners', group: 'merchandise' },
    { key: 'merchandise_orders', name: 'Merchandise Orders', group: 'merchandise' },
    { key: 'merchandise_reviews', name: 'Merchandise Reviews', group: 'merchandise' },
    { key: 'contact_enquiries', name: 'Contact Enquiries', group: 'enquiries' },
    { key: 'corporate_enquiries', name: 'Corporate Enquiries', group: 'enquiries' },
    { key: 'franchise_enquiries', name: 'Franchise Enquiries', group: 'enquiries' },
    { key: 'career_applications', name: 'Career Applications', group: 'enquiries' },
    { key: 'career_jobs', name: 'Career Jobs', group: 'enquiries' },
    { key: 'reservations', name: 'Reservations', group: 'enquiries' },
    { key: 'support_tickets', name: 'Support Tickets', group: 'enquiries' },
    { key: 'offers', name: 'Offers', group: 'marketing' },
    { key: 'blog_posts', name: 'Blog Posts', group: 'marketing' },
    { key: 'blog', name: 'Blog', group: 'marketing' },
    { key: 'gallery', name: 'Gallery', group: 'marketing' },
    { key: 'events', name: 'Events', group: 'marketing' },
    { key: 'instagram_media', name: 'Instagram Media', group: 'marketing' },
    { key: 'newsletter_subscribers', name: 'Newsletter Subscribers', group: 'marketing' },
    { key: 'app_promos', name: 'App Promos', group: 'marketing' },
    { key: 'testimonials', name: 'Testimonials', group: 'marketing' },
    { key: 'seo_pages', name: 'SEO Pages', group: 'marketing' },
    { key: 'seo', name: 'SEO', group: 'marketing' },
    { key: 'legal_pages', name: 'Legal Pages', group: 'marketing' }
  ];

  const actions = ['view', 'create', 'edit', 'delete', 'export'];

  console.log('--- Existing permissions ---');
  const [existing] = await conn.execute('SELECT module_key, permission_key FROM admin_permissions');
  console.log(`Found ${existing.length} existing permissions`);
  const existingKeys = new Set(existing.map(p => p.permission_key));

  console.log('--- Seeding missing permissions ---');
  let inserted = 0;
  for (const mod of requiredModules) {
    for (const action of actions) {
      const permissionKey = `${mod.key}.${action}`;
      if (existingKeys.has(permissionKey)) {
        continue;
      }
      await conn.execute(
        `INSERT INTO admin_permissions (module_key, module_name, permission_key, permission_name, permission_group)
         VALUES (?, ?, ?, ?, ?)`,
        [mod.key, mod.name, permissionKey, `${mod.name} ${action.charAt(0).toUpperCase() + action.slice(1)}`, mod.group]
      );
      inserted++;
    }
  }

  console.log(`Inserted ${inserted} missing permissions`);

  console.log('--- Granting all permissions to Super Admin role ---');
  const [superRole] = await conn.execute(`SELECT id FROM admin_roles WHERE role_key = 'super_admin' LIMIT 1`);
  if (superRole.length) {
    const roleId = superRole[0].id;
    const [allPerms] = await conn.execute(`SELECT id FROM admin_permissions`);
    let granted = 0;
    for (const perm of allPerms) {
      await conn.execute(
        `INSERT INTO admin_role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_export)
         VALUES (?, ?, 1, 1, 1, 1, 1)
         ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1, can_export=1`,
        [roleId, perm.id]
      );
      granted++;
    }
    console.log(`Granted/updated ${granted} permissions for super_admin role`);
  }

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
