const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bigbean_cafe'
  });

  try {
    console.log('Starting RBAC migration...');

    // Read and execute the migration file
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('./migrations/create_admin_rbac_tables.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.execute(stmt);
      }
    }
    console.log('✅ Tables created successfully');

    // Seed system roles
    console.log('Seeding system roles...');
    const roles = [
      { role_name: 'Super Admin', role_key: 'super_admin', description: 'Full system access', is_system: 1 },
      { role_name: 'Store Manager', role_key: 'store_manager', description: 'Manages store operations', is_system: 0 },
      { role_name: 'Event Host', role_key: 'event_host', description: 'Manages events and reservations', is_system: 0 },
      { role_name: 'Marketing Manager', role_key: 'marketing_manager', description: 'Manages marketing content', is_system: 0 },
      { role_name: 'Support Executive', role_key: 'support_executive', description: 'Handles customer support', is_system: 0 },
      { role_name: 'Order Manager', role_key: 'order_manager', description: 'Manages merchandise orders', is_system: 0 },
      { role_name: 'Content Manager', role_key: 'content_manager', description: 'Manages website content', is_system: 0 },
      { role_name: 'Accounts Manager', role_key: 'accounts_manager', description: 'Manages accounts and reports', is_system: 0 }
    ];

    for (const role of roles) {
      const [existing] = await connection.execute('SELECT id FROM admin_roles WHERE role_key = ?', [role.role_key]);
      if (existing.length === 0) {
        await connection.execute(
          'INSERT INTO admin_roles (role_name, role_key, description, is_system) VALUES (?, ?, ?, ?)',
          [role.role_name, role.role_key, role.description, role.is_system]
        );
        console.log(`  ✅ Created role: ${role.role_name}`);
      } else {
        console.log(`  ⏭️  Role exists: ${role.role_name}`);
      }
    }

    // Seed permissions
    console.log('Seeding permissions...');
    const modules = [
      // MAIN
      { module_key: 'dashboard', module_name: 'Dashboard', permission_group: 'MAIN' },
      { module_key: 'notifications', module_name: 'Notifications', permission_group: 'MAIN' },
      { module_key: 'reports', module_name: 'Reports', permission_group: 'MAIN' },
      { module_key: 'settings', module_name: 'Settings', permission_group: 'MAIN' },
      { module_key: 'admin_users', module_name: 'Admin Users', permission_group: 'MAIN' },
      { module_key: 'customers', module_name: 'Customers', permission_group: 'MAIN' },
      
      // WEBSITE CONTENT
      { module_key: 'home_banners', module_name: 'Home Banners', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'about_hero', module_name: 'About Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'menu_hero', module_name: 'Menu Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'offers_hero', module_name: 'Offers Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'outlet_hero', module_name: 'Outlet Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'reservation_hero', module_name: 'Reservation Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'career_hero', module_name: 'Career Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'corporate_hero', module_name: 'Corporate Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'franchise_hero', module_name: 'Franchise Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'gallery_hero', module_name: 'Gallery Hero', permission_group: 'WEBSITE CONTENT' },
      { module_key: 'blog_hero', module_name: 'Blog Hero', permission_group: 'WEBSITE CONTENT' },
      
      // MENU
      { module_key: 'menu_items', module_name: 'Menu Items', permission_group: 'MENU' },
      { module_key: 'menu_combos', module_name: 'Menu Combos', permission_group: 'MENU' },
      { module_key: 'menu_categories', module_name: 'Menu Categories', permission_group: 'MENU' },
      
      // MERCHANDISE
      { module_key: 'merchandise', module_name: 'Merchandise', permission_group: 'MERCHANDISE' },
      { module_key: 'merchandise_categories', module_name: 'Merchandise Categories', permission_group: 'MERCHANDISE' },
      { module_key: 'merchandise_banners', module_name: 'Merchandise Banners', permission_group: 'MERCHANDISE' },
      { module_key: 'merchandise_orders', module_name: 'Merchandise Orders', permission_group: 'MERCHANDISE' },
      { module_key: 'merchandise_reviews', module_name: 'Merchandise Reviews', permission_group: 'MERCHANDISE' },
      
      // ENQUIRIES
      { module_key: 'contact_enquiries', module_name: 'Contact Enquiries', permission_group: 'ENQUIRIES' },
      { module_key: 'corporate_enquiries', module_name: 'Corporate Enquiries', permission_group: 'ENQUIRIES' },
      { module_key: 'franchise_enquiries', module_name: 'Franchise Enquiries', permission_group: 'ENQUIRIES' },
      { module_key: 'career_applications', module_name: 'Career Applications', permission_group: 'ENQUIRIES' },
      { module_key: 'reservations', module_name: 'Reservations', permission_group: 'ENQUIRIES' },
      { module_key: 'support_tickets', module_name: 'Support Tickets', permission_group: 'ENQUIRIES' },
      
      // MARKETING
      { module_key: 'offers', module_name: 'Offers', permission_group: 'MARKETING' },
      { module_key: 'blog', module_name: 'Blog', permission_group: 'MARKETING' },
      { module_key: 'gallery', module_name: 'Gallery', permission_group: 'MARKETING' },
      { module_key: 'events', module_name: 'Events', permission_group: 'MARKETING' },
      { module_key: 'instagram_media', module_name: 'Instagram Media', permission_group: 'MARKETING' },
      { module_key: 'newsletter_subscribers', module_name: 'Newsletter Subscribers', permission_group: 'MARKETING' },
      { module_key: 'app_promos', module_name: 'App Promos', permission_group: 'MARKETING' },
      { module_key: 'testimonials', module_name: 'Testimonials', permission_group: 'MARKETING' },
      { module_key: 'seo', module_name: 'SEO', permission_group: 'MARKETING' },
      
      // LEGAL
      { module_key: 'legal_pages', module_name: 'Legal Pages', permission_group: 'LEGAL' },
      
      // USERS
      { module_key: 'roles_permissions', module_name: 'Roles & Permissions', permission_group: 'USERS' }
    ];

    const actions = ['view', 'create', 'edit', 'delete', 'export'];
    let sortOrder = 0;

    for (const module of modules) {
      for (const action of actions) {
        // Skip export for some modules
        if (action === 'export' && ['settings', 'admin_users', 'roles_permissions'].includes(module.module_key)) {
          continue;
        }
        
        const permissionKey = `${module.module_key}.${action}`;
        const permissionName = `${module.module_name} - ${action.charAt(0).toUpperCase() + action.slice(1)}`;
        
        const [existing] = await connection.execute(
          'SELECT id FROM admin_permissions WHERE permission_key = ?',
          [permissionKey]
        );
        
        if (existing.length === 0) {
          await connection.execute(
            'INSERT INTO admin_permissions (module_key, module_name, permission_key, permission_name, permission_group, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [module.module_key, module.module_name, permissionKey, permissionName, module.permission_group, sortOrder++]
          );
        }
      }
    }
    console.log('✅ Permissions seeded successfully');

    // Get role IDs
    const [rolesData] = await connection.execute('SELECT id, role_key FROM admin_roles');
    const roleMap = {};
    rolesData.forEach(r => roleMap[r.role_key] = r.id);

    // Get all permissions
    const [permissionsData] = await connection.execute('SELECT id, permission_key FROM admin_permissions');
    const permissionMap = {};
    permissionsData.forEach(p => permissionMap[p.permission_key] = p.id);

    // Seed default role permissions
    console.log('Seeding default role permissions...');
    
    // Super Admin - all permissions
    const superAdminId = roleMap['super_admin'];
    if (superAdminId) {
      for (const perm of permissionsData) {
        const [existing] = await connection.execute(
          'SELECT id FROM admin_role_permissions WHERE role_id = ? AND permission_id = ?',
          [superAdminId, perm.id]
        );
        if (existing.length === 0) {
          await connection.execute(
            'INSERT INTO admin_role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_export) VALUES (?, ?, 1, 1, 1, 1, 1)',
            [superAdminId, perm.id]
          );
        }
      }
      console.log('  ✅ Super Admin permissions set');
    }

    // Store Manager permissions
    const storeManagerPerms = [
      'dashboard.view', 'notifications.view', 'reports.view',
      'merchandise_orders.view', 'merchandise_orders.edit', 'merchandise_orders.export',
      'customers.view', 'support_tickets.view', 'support_tickets.edit', 'support_tickets.create'
    ];
    await seedRolePermissions(connection, roleMap['store_manager'], storeManagerPerms, permissionMap);

    // Order Manager permissions
    const orderManagerPerms = [
      'dashboard.view', 'notifications.view',
      'merchandise_orders.view', 'merchandise_orders.edit', 'merchandise_orders.export',
      'merchandise.view', 'customers.view'
    ];
    await seedRolePermissions(connection, roleMap['order_manager'], orderManagerPerms, permissionMap);

    // Event Host permissions
    const eventHostPerms = [
      'dashboard.view', 'notifications.view',
      'events.view', 'events.create', 'events.edit',
      'reservations.view', 'reservations.edit', 'reservations.export',
      'contact_enquiries.view'
    ];
    await seedRolePermissions(connection, roleMap['event_host'], eventHostPerms, permissionMap);

    // Marketing Manager permissions
    const marketingManagerPerms = [
      'dashboard.view', 'notifications.view',
      'home_banners.view', 'home_banners.create', 'home_banners.edit', 'home_banners.delete',
      'offers.view', 'offers.create', 'offers.edit', 'offers.delete',
      'offers_hero.view', 'offers_hero.create', 'offers_hero.edit',
      'blog.view', 'blog.create', 'blog.edit', 'blog.delete',
      'gallery.view', 'gallery.create', 'gallery.edit', 'gallery.delete',
      'instagram_media.view', 'instagram_media.create', 'instagram_media.edit',
      'newsletter_subscribers.view', 'newsletter_subscribers.export',
      'seo.view', 'seo.create', 'seo.edit',
      'app_promos.view', 'app_promos.create', 'app_promos.edit'
    ];
    await seedRolePermissions(connection, roleMap['marketing_manager'], marketingManagerPerms, permissionMap);

    // Support Executive permissions
    const supportExecPerms = [
      'dashboard.view', 'notifications.view',
      'support_tickets.view', 'support_tickets.create', 'support_tickets.edit',
      'contact_enquiries.view', 'contact_enquiries.edit',
      'reservations.view', 'reservations.edit',
      'corporate_enquiries.view', 'franchise_enquiries.view'
    ];
    await seedRolePermissions(connection, roleMap['support_executive'], supportExecPerms, permissionMap);

    // Content Manager permissions
    const contentManagerPerms = [
      'dashboard.view', 'notifications.view',
      'home_banners.view', 'home_banners.create', 'home_banners.edit',
      'about_hero.view', 'about_hero.create', 'about_hero.edit',
      'menu_hero.view', 'menu_hero.create', 'menu_hero.edit',
      'outlet_hero.view', 'outlet_hero.create', 'outlet_hero.edit',
      'gallery.view', 'gallery.create', 'gallery.edit',
      'blog.view', 'blog.create', 'blog.edit',
      'legal_pages.view', 'legal_pages.create', 'legal_pages.edit'
    ];
    await seedRolePermissions(connection, roleMap['content_manager'], contentManagerPerms, permissionMap);

    // Accounts Manager permissions
    const accountsManagerPerms = [
      'dashboard.view', 'notifications.view',
      'merchandise_orders.view', 'merchandise_orders.export',
      'reports.view', 'reports.export',
      'customers.view'
    ];
    await seedRolePermissions(connection, roleMap['accounts_manager'], accountsManagerPerms, permissionMap);

    console.log('✅ Role permissions seeded successfully');

    // Check if existing admin exists and migrate
    console.log('Checking for existing admin users...');
    
    // Check if admins table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'admins'");
    
    if (tables.length > 0) {
      const [existingAdmins] = await connection.execute('SELECT * FROM admins LIMIT 1');
    
      if (existingAdmins.length > 0) {
        const admin = existingAdmins[0];
        console.log(`Found existing admin: ${admin.email}`);
        
        // Check if already migrated
        const [migrated] = await connection.execute('SELECT id FROM admin_users WHERE email = ?', [admin.email]);
        
        if (migrated.length === 0) {
          // Migrate to admin_users
          await connection.execute(
            'INSERT INTO admin_users (name, email, phone, password, role_id, status) VALUES (?, ?, ?, ?, ?, ?)',
            [admin.name || admin.username || 'Admin', admin.email, admin.phone || null, admin.password, roleMap['super_admin'], 'active']
          );
          console.log('✅ Migrated existing admin to new system');
        } else {
          console.log('⏭️  Admin already migrated');
        }
      } else {
        // Create default Super Admin if none exists
        const [adminUsers] = await connection.execute('SELECT COUNT(*) as count FROM admin_users');
        if (adminUsers[0].count === 0) {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          await connection.execute(
            'INSERT INTO admin_users (name, email, password, role_id, status) VALUES (?, ?, ?, ?, ?)',
            ['Super Admin', 'admin@bigbeancafe.in', hashedPassword, roleMap['super_admin'], 'active']
          );
          console.log('✅ Created default Super Admin (admin@bigbeancafe.in / admin123)');
        }
      }
    } else {
      // No admins table exists, create default Super Admin
      const [adminUsers] = await connection.execute('SELECT COUNT(*) as count FROM admin_users');
      if (adminUsers[0].count === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await connection.execute(
          'INSERT INTO admin_users (name, email, password, role_id, status) VALUES (?, ?, ?, ?, ?)',
          ['Super Admin', 'admin@bigbeancafe.in', hashedPassword, roleMap['super_admin'], 'active']
        );
        console.log('✅ Created default Super Admin (admin@bigbeancafe.in / admin123)');
      }
    }

    console.log('✅ RBAC migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function seedRolePermissions(connection, roleId, permissionKeys, permissionMap) {
  if (!roleId) return;
  
  for (const key of permissionKeys) {
    const permId = permissionMap[key];
    if (!permId) continue;
    
    const [existing] = await connection.execute(
      'SELECT id FROM admin_role_permissions WHERE role_id = ? AND permission_id = ?',
      [roleId, permId]
    );
    
    if (existing.length === 0) {
      const action = key.split('.')[1];
      const perms = {
        can_view: action === 'view' ? 1 : 0,
        can_create: action === 'create' ? 1 : 0,
        can_edit: action === 'edit' ? 1 : 0,
        can_delete: action === 'delete' ? 1 : 0,
        can_export: action === 'export' ? 1 : 0
      };
      
      await connection.execute(
        'INSERT INTO admin_role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_export) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [roleId, permId, perms.can_view, perms.can_create, perms.can_edit, perms.can_delete, perms.can_export]
      );
    }
  }
}

runMigration().catch(console.error);
