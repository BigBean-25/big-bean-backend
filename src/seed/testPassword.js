require('dotenv').config();
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');

const testPassword = async () => {
  try {
    console.log('🔍 Testing password verification...');

    // Get admin user
    const users = await executeQuery(
      'SELECT password FROM users WHERE email = ?',
      ['admin@bigbeancafe.in']
    );

    if (users.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const storedHash = users[0].password;
    const testPassword = 'admin123';
    
    console.log('🔑 Stored Hash:', storedHash);
    console.log('🧪 Testing Password:', testPassword);
    
    // Test password comparison
    const isValid = await bcrypt.compare(testPassword, storedHash);
    console.log('✅ Password Valid:', isValid);
    
    // Also test creating a new hash
    const newHash = await bcrypt.hash(testPassword, 12);
    console.log('🔑 New Hash:', newHash);
    const isNewHashValid = await bcrypt.compare(testPassword, newHash);
    console.log('✅ New Hash Valid:', isNewHashValid);

  } catch (error) {
    console.error('❌ Error testing password:', error);
    process.exit(1);
  }
};

testPassword()
  .then(() => {
    console.log('🎉 Password test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Password test failed:', error);
    process.exit(1);
  });
