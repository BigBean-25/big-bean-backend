const { executeQuery } = require('../src/config/database');

const sql = `
SELECT
  au.id,
  au.name,
  au.email,
  au.phone,
  au.designation,
  au.status,
  au.role_id,
  ar.role_name,
  ar.role_key,
  au.last_login_at,
  au.created_at,
  COALESCE(pc.permission_count, 0) AS permission_count
FROM admin_users au
LEFT JOIN admin_roles ar ON ar.id = au.role_id
LEFT JOIN (
  SELECT
    user_id,
    COUNT(*) AS permission_count
  FROM admin_user_permissions
  WHERE
    can_view = 1
    OR can_create = 1
    OR can_edit = 1
    OR can_delete = 1
    OR can_export = 1
  GROUP BY user_id
) pc ON pc.user_id = au.id
ORDER BY au.created_at DESC
`;

executeQuery(sql)
  .then(rows => {
    console.log('OK', rows.length, 'users');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('ERROR', err.message);
    process.exit(1);
  });
