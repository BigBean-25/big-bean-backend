require('dotenv').config();
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');

const createAdminUser = async () => {
  try {
    console.log('🌱 Creating admin user...');

    // Check if admin user already exists
    const existingAdmin = await executeQuery(
      'SELECT id FROM users WHERE email = ?',
      ['admin@bigbeancafe.in']
    );

    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Insert admin user
    const result = await executeQuery(
      `INSERT INTO users (username, email, password, role, status) 
       VALUES (?, ?, ?, ?, ?)`,
      ['admin', 'admin@bigbeancafe.in', hashedPassword, 'super_admin', 'active']
    );

    console.log('✅ Admin user created successfully');
    console.log('📧 Email: admin@bigbeancafe.in');
    console.log('🔑 Password: admin123');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

// Run the seed script
if (require.main === module) {
  createAdminUser()
    .then(() => {
      console.log('🎉 Admin seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Admin seed failed:', error);
      process.exit(1);
    });
}

module.exports = { createAdminUser };
