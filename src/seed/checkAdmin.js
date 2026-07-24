require('dotenv').config();
const { executeQuery } = require('../config/database');

const checkAdminUser = async () => {
  try {
    console.log('🔍 Checking admin user...');

    // Get admin user
    const users = await executeQuery(
      'SELECT id, username, email, password, role, status, created_at FROM users WHERE email = ?',
      ['admin@bigbeancafe.in']
    );

    if (users.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const user = users[0];
    console.log('✅ Admin user found:');
    console.log('📧 Email:', user.email);
    console.log('👤 Username:', user.username);
    console.log('🔐 Role:', user.role);
    console.log('📊 Status:', user.status);
    console.log('🕒 Created:', user.created_at);
    console.log('🔑 Password Hash Length:', user.password.length);

  } catch (error) {
    console.error('❌ Error checking admin user:', error);
    process.exit(1);
  }
};

checkAdminUser()
  .then(() => {
    console.log('🎉 Admin check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Admin check failed:', error);
    process.exit(1);
  });
