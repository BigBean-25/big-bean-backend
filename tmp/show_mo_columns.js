const { executeQuery } = require('../src/config/database');

executeQuery('SHOW COLUMNS FROM merchandise_orders')
  .then(c => console.log(c.map(r => r.Field).join(', ')))
  .catch(e => console.error(e))
  .finally(() => process.exit(0));
