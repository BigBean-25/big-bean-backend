require('dotenv').config();
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');

const fixAdminUser = async () => {
  try {
    console.log('🔄 Fixing admin user...');
    
    // Delete existing admin user
    await executeQuery('DELETE FROM users WHERE email = ?', ['admin@bigbeancafe.in']);
    console.log('🗑️  Deleted existing admin user');
    
    // Create new password hash
    const hashedPassword = await bcrypt.hash('admin123', 12);
    console.log('🔑 Created new password hash');
    
    // Insert new admin user
    await executeQuery(
      'INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@bigbeancafe.in', hashedPassword, 'admin', 'active']
    );
    console.log('✅ Created new admin user');
    
    // Test the new user
    const users = await executeQuery('SELECT * FROM users WHERE email = ?', ['admin@bigbeancafe.in']);
    const isValid = await bcrypt.compare('admin123', users[0].password);
    console.log('✅ Password test:', isValid);
    
    console.log('🎉 Admin user fixed successfully');
    
  } catch (error) {
    console.error('❌ Error fixing admin user:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  fixAdminUser()
    .then(() => {
      console.log('🎉 Admin fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Admin fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAdminUser };
