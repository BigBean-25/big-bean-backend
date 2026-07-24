const { executeQuery } = require('../config/database');

const toBool = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  const s = String(v || '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

// ─── Ensure tables ────────────────────────────────────────────────────────────
const ensureTables = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(150) NOT NULL UNIQUE,
      setting_value LONGTEXT NULL,
      setting_group VARCHAR(80) NOT NULL DEFAULT 'general',
      input_type VARCHAR(50) DEFAULT 'text',
      is_public TINYINT(1) DEFAULT 0,
      is_secret TINYINT(1) DEFAULT 0,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module_name VARCHAR(100) NULL,
      record_id INT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NULL,
      message TEXT NULL,
      status ENUM('sent','failed') DEFAULT 'sent',
      error_message TEXT NULL,
      sent_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS settings_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NULL,
      setting_key VARCHAR(150) NULL,
      old_value LONGTEXT NULL,
      new_value LONGTEXT NULL,
      action VARCHAR(100) DEFAULT 'update',
      ip_address VARCHAR(100) NULL,
      user_agent TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

// ─── Secret keys ──────────────────────────────────────────────────────────────
const SECRET_KEYS = new Set([
  'razorpay_key_secret', 'razorpay_webhook_secret', 'smtp_password',
  'msg91_auth_key', 'whatsapp_api_key', 'whatsapp_access_token', 'instagram_access_token',
  'captcha_secret_key',
]);
const MASK = '********';

// ─── Seed defaults ────────────────────────────────────────────────────────────
const SEED = [
  // general
  { k: 'site_name',           v: 'Big Bean Café',                 g: 'general',  t: 'text',     pub: 1 },
  { k: 'site_description',    v: 'Premium coffee experience',      g: 'general',  t: 'textarea', pub: 1 },
  { k: 'website_url',         v: 'https://www.bigbeancafe.in',     g: 'general',  t: 'url',      pub: 1 },
  { k: 'store_url',           v: 'https://bigbeancafe.store',      g: 'general',  t: 'url',      pub: 1 },
  { k: 'timezone',            v: 'Asia/Kolkata',                   g: 'general',  t: 'text',     pub: 0 },
  { k: 'currency',            v: 'INR',                            g: 'general',  t: 'text',     pub: 1 },
  { k: 'language',            v: 'en',                             g: 'general',  t: 'text',     pub: 1 },
  { k: 'business_type',       v: 'Café & Coffee Roasters',         g: 'general',  t: 'text',     pub: 1 },
  { k: 'contact_email',       v: 'info@bigbeancafe.in',            g: 'general',  t: 'email',    pub: 1 },
  { k: 'contact_phone',       v: '8073601065',                     g: 'general',  t: 'text',     pub: 1 },
  { k: 'address',             v: 'Bengaluru, Karnataka, India',    g: 'general',  t: 'textarea', pub: 1 },
  // branding
  { k: 'logo_url',            v: '/logo/big-bean-cafe-logo-transparent.png', g: 'branding', t: 'url', pub: 1 },
  { k: 'footer_logo_url',     v: '',                               g: 'branding', t: 'url',      pub: 1 },
  { k: 'favicon_url',         v: '/favicon.ico',                   g: 'branding', t: 'url',      pub: 1 },
  { k: 'default_og_image',    v: '',                               g: 'branding', t: 'url',      pub: 1 },
  { k: 'primary_color',       v: '#3D1F0D',                        g: 'branding', t: 'color',    pub: 1 },
  { k: 'secondary_color',     v: '#C9943A',                        g: 'branding', t: 'color',    pub: 1 },
  { k: 'accent_color',        v: '#2FBF9B',                        g: 'branding', t: 'color',    pub: 1 },
  // website_content
  { k: 'homepage_notice',        v: '',                                        g: 'website_content', t: 'textarea', pub: 1 },
  { k: 'header_order_button_text', v: 'Order Online',                          g: 'website_content', t: 'text',     pub: 1 },
  { k: 'header_order_button_url',  v: 'https://bigbeancafe.store',             g: 'website_content', t: 'url',      pub: 1 },
  { k: 'footer_description',    v: 'Fresh coffee, handcrafted beverages, café bites, desserts, and cozy café moments across Big Bean Café outlets.', g: 'website_content', t: 'textarea', pub: 1 },
  { k: 'copyright_text',        v: '© {year} Big Bean Café Coffee Roasters. All rights reserved.', g: 'website_content', t: 'text', pub: 1 },
  { k: 'terms_url',             v: '/terms-and-conditions',                   g: 'website_content', t: 'url',      pub: 1 },
  { k: 'privacy_url',           v: '/privacy-policy',                         g: 'website_content', t: 'url',      pub: 1 },
  // social_media
  { k: 'social_facebook',    v: 'https://facebook.com/bigbeancafe',           g: 'social_media', t: 'url', pub: 1 },
  { k: 'social_instagram',   v: 'https://www.instagram.com/bigbeancafe.in/',  g: 'social_media', t: 'url', pub: 1 },
  { k: 'social_linkedin',    v: '',   g: 'social_media', t: 'url', pub: 1 },
  { k: 'social_youtube',     v: '',   g: 'social_media', t: 'url', pub: 1 },
  { k: 'social_twitter',     v: '',   g: 'social_media', t: 'url', pub: 1 },
  { k: 'social_zomato',      v: '',   g: 'social_media', t: 'url', pub: 1 },
  { k: 'social_swiggy',      v: '',   g: 'social_media', t: 'url', pub: 1 },
  { k: 'social_threads',     v: '',   g: 'social_media', t: 'url', pub: 1 },
  // app_promo
  { k: 'app_promo_enabled',         v: '0',          g: 'app_promo', t: 'toggle', pub: 1 },
  { k: 'app_download_title',        v: 'Get the App', g: 'app_promo', t: 'text',   pub: 1 },
  { k: 'app_download_description',  v: '',            g: 'app_promo', t: 'textarea', pub: 1 },
  { k: 'android_app_url',           v: '',            g: 'app_promo', t: 'url',    pub: 1 },
  { k: 'ios_app_url',               v: '',            g: 'app_promo', t: 'url',    pub: 1 },
  { k: 'app_qr_image',              v: '',            g: 'app_promo', t: 'url',    pub: 1 },
  { k: 'app_banner_image',          v: '',            g: 'app_promo', t: 'url',    pub: 1 },
  // payment_gateway
  { k: 'payment_enabled',            v: '0',     g: 'payment_gateway', t: 'toggle', pub: 0 },
  { k: 'payment_provider',           v: 'razorpay', g: 'payment_gateway', t: 'text', pub: 0 },
  { k: 'payment_mode',               v: 'test',  g: 'payment_gateway', t: 'text',   pub: 0 },
  { k: 'razorpay_key_id',            v: '',      g: 'payment_gateway', t: 'text',   pub: 0 },
  { k: 'razorpay_key_secret',        v: '',      g: 'payment_gateway', t: 'password', pub: 0, sec: 1 },
  { k: 'razorpay_webhook_secret',    v: '',      g: 'payment_gateway', t: 'password', pub: 0, sec: 1 },
  { k: 'cod_enabled',                v: '1',     g: 'payment_gateway', t: 'toggle', pub: 0 },
  { k: 'online_payment_enabled',     v: '0',     g: 'payment_gateway', t: 'toggle', pub: 0 },
  // email_smtp
  { k: 'smtp_enabled',       v: '0',          g: 'email_smtp', t: 'toggle',   pub: 0 },
  { k: 'smtp_host',          v: '',           g: 'email_smtp', t: 'text',     pub: 0 },
  { k: 'smtp_port',          v: '587',        g: 'email_smtp', t: 'text',     pub: 0 },
  { k: 'smtp_secure',        v: 'false',      g: 'email_smtp', t: 'text',     pub: 0 },
  { k: 'smtp_user',          v: '',           g: 'email_smtp', t: 'text',     pub: 0 },
  { k: 'smtp_password',      v: '',           g: 'email_smtp', t: 'password', pub: 0, sec: 1 },
  { k: 'mail_from_name',     v: 'Big Bean Café', g: 'email_smtp', t: 'text',  pub: 0 },
  { k: 'mail_from_email',    v: 'noreply@bigbeancafe.in', g: 'email_smtp', t: 'email', pub: 0 },
  { k: 'admin_notification_email', v: 'info@bigbeancafe.in', g: 'email_smtp', t: 'email', pub: 0 },
  // sms_whatsapp
  { k: 'sms_enabled',              v: '0', g: 'sms_whatsapp', t: 'toggle',   pub: 0 },
  { k: 'sms_provider',             v: 'msg91', g: 'sms_whatsapp', t: 'text', pub: 0 },
  { k: 'msg91_auth_key',           v: '',  g: 'sms_whatsapp', t: 'password', pub: 0, sec: 1 },
  { k: 'msg91_sender_id',          v: '',  g: 'sms_whatsapp', t: 'text',     pub: 0 },
  { k: 'msg91_template_id',        v: '',  g: 'sms_whatsapp', t: 'text',     pub: 0 },
  { k: 'whatsapp_enabled',         v: '0', g: 'sms_whatsapp', t: 'toggle',   pub: 0 },
  { k: 'whatsapp_provider',        v: '',  g: 'sms_whatsapp', t: 'text',     pub: 0 },
  { k: 'whatsapp_api_key',         v: '',  g: 'sms_whatsapp', t: 'password', pub: 0, sec: 1 },
  { k: 'whatsapp_access_token',    v: '',  g: 'sms_whatsapp', t: 'password', pub: 0, sec: 1 },
  { k: 'whatsapp_phone_number_id', v: '',  g: 'sms_whatsapp', t: 'text',     pub: 0 },
  { k: 'whatsapp_business_number', v: '',  g: 'sms_whatsapp', t: 'text',     pub: 0 },
  // contact
  { k: 'reservations_phone',  v: '8073601065',               g: 'contact', t: 'text',  pub: 1 },
  { k: 'reservations_email',  v: 'bookings@bigbeancafe.in',  g: 'contact', t: 'email', pub: 1 },
  { k: 'franchise_phone',     v: '8867671422',               g: 'contact', t: 'text',  pub: 1 },
  { k: 'franchise_email',     v: 'franchise@bigbeancafe.in', g: 'contact', t: 'email', pub: 1 },
  { k: 'corporate_phone',     v: '8073601065',               g: 'contact', t: 'text',  pub: 1 },
  { k: 'corporate_email',     v: 'bookings@bigbeancafe.in',  g: 'contact', t: 'email', pub: 1 },
  { k: 'career_phone',        v: '8073601065',               g: 'contact', t: 'text',  pub: 1 },
  { k: 'career_email',        v: 'jobs@bigbeancafe.in',      g: 'contact', t: 'email', pub: 1 },
  { k: 'event_phone',         v: '8073601065',               g: 'contact', t: 'text',  pub: 1 },
  { k: 'event_email',         v: 'events@bigbeancafe.in',    g: 'contact', t: 'email', pub: 1 },
  { k: 'no_reply_email',      v: 'noreply@bigbeancafe.in',   g: 'contact', t: 'email', pub: 0 },
  // outlets
  { k: 'default_outlet_id',         v: '',    g: 'outlets', t: 'text',   pub: 0 },
  { k: 'show_outlet_status',        v: '1',   g: 'outlets', t: 'toggle', pub: 1 },
  { k: 'show_outlet_map',           v: '1',   g: 'outlets', t: 'toggle', pub: 1 },
  { k: 'outlet_page_seo_suffix',    v: '| Big Bean Café', g: 'outlets', t: 'text', pub: 0 },
  { k: 'enable_outlet_slug_pages',  v: '1',   g: 'outlets', t: 'toggle', pub: 1 },
  // menu
  { k: 'menu_download_enabled',      v: '0',  g: 'menu', t: 'toggle', pub: 1 },
  { k: 'menu_pdf_url',               v: '',   g: 'menu', t: 'url',    pub: 1 },
  { k: 'show_menu_prices',           v: '1',  g: 'menu', t: 'toggle', pub: 1 },
  { k: 'show_menu_images',           v: '1',  g: 'menu', t: 'toggle', pub: 1 },
  { k: 'show_veg_nonveg_indicators', v: '1',  g: 'menu', t: 'toggle', pub: 1 },
  { k: 'menu_order_button_enabled',  v: '1',  g: 'menu', t: 'toggle', pub: 1 },
  // offers_coupons
  { k: 'coupons_enabled',          v: '1',  g: 'offers_coupons', t: 'toggle',   pub: 1 },
  { k: 'default_coupon_terms',     v: '',   g: 'offers_coupons', t: 'textarea', pub: 0 },
  { k: 'show_expired_offers',      v: '0',  g: 'offers_coupons', t: 'toggle',   pub: 0 },
  { k: 'offer_banner_enabled',     v: '1',  g: 'offers_coupons', t: 'toggle',   pub: 1 },
  { k: 'first_order_coupon_code',  v: '',   g: 'offers_coupons', t: 'text',     pub: 0 },
  // seo
  { k: 'google_analytics_id',              v: '', g: 'seo', t: 'text', pub: 0 },
  { k: 'google_tag_manager_id',            v: '', g: 'seo', t: 'text', pub: 0 },
  { k: 'google_search_console_verification', v: '', g: 'seo', t: 'text', pub: 0 },
  { k: 'facebook_pixel_id',               v: '', g: 'seo', t: 'text', pub: 0 },
  { k: 'bing_verification',               v: '', g: 'seo', t: 'text', pub: 0 },
  { k: 'default_meta_title',              v: 'Big Bean Café — Premium Coffee Experience', g: 'seo', t: 'text', pub: 0 },
  { k: 'default_meta_description',        v: 'Discover Big Bean Café — fresh coffee, handcrafted beverages and cozy café moments across Bengaluru.', g: 'seo', t: 'textarea', pub: 0 },
  { k: 'robots_index_default',            v: '1', g: 'seo', t: 'toggle', pub: 0 },
  // career
  { k: 'career_enabled',              v: '1',  g: 'career', t: 'toggle',   pub: 1 },
  { k: 'career_apply_email',          v: 'careers@bigbeancafe.in', g: 'career', t: 'email', pub: 0 },
  { k: 'career_resume_required',      v: '0',  g: 'career', t: 'toggle',   pub: 0 },
  { k: 'career_auto_reply_enabled',   v: '0',  g: 'career', t: 'toggle',   pub: 0 },
  { k: 'career_auto_reply_message',   v: 'Thank you for applying! We will review your application and get back to you.', g: 'career', t: 'textarea', pub: 0 },
  // franchise
  { k: 'franchise_enabled',               v: '1',  g: 'franchise', t: 'toggle',   pub: 1 },
  { k: 'franchise_notification_email',    v: 'franchise@bigbeancafe.in', g: 'franchise', t: 'email', pub: 0 },
  { k: 'franchise_auto_reply_enabled',    v: '0',  g: 'franchise', t: 'toggle',   pub: 0 },
  { k: 'franchise_auto_reply_message',    v: 'Thank you for your franchise interest! Our team will contact you shortly.', g: 'franchise', t: 'textarea', pub: 0 },
  // corporate_orders
  { k: 'corporate_orders_enabled',        v: '1',  g: 'corporate_orders', t: 'toggle', pub: 1 },
  { k: 'corporate_notification_email',    v: 'corporate@bigbeancafe.in', g: 'corporate_orders', t: 'email', pub: 0 },
  { k: 'minimum_corporate_order_value',   v: '2000', g: 'corporate_orders', t: 'text', pub: 0 },
  { k: 'corporate_auto_reply_enabled',    v: '0',  g: 'corporate_orders', t: 'toggle', pub: 0 },
  // gallery
  { k: 'gallery_enabled',           v: '1',  g: 'gallery', t: 'toggle', pub: 1 },
  { k: 'instagram_feed_enabled',    v: '0',  g: 'gallery', t: 'toggle', pub: 0 },
  { k: 'instagram_access_token',    v: '',   g: 'gallery', t: 'password', pub: 0, sec: 1 },
  { k: 'gallery_auto_approve',      v: '1',  g: 'gallery', t: 'toggle', pub: 0 },
  // blog
  { k: 'blog_enabled',              v: '1',  g: 'blog', t: 'toggle',   pub: 1 },
  { k: 'blog_comments_enabled',     v: '0',  g: 'blog', t: 'toggle',   pub: 0 },
  { k: 'blog_author_default',       v: 'Big Bean Café Team', g: 'blog', t: 'text', pub: 0 },
  { k: 'blog_seo_suffix',           v: '| Big Bean Café Blog', g: 'blog', t: 'text', pub: 0 },
  // users_roles
  { k: 'allow_multiple_admins',      v: '1',   g: 'users_roles', t: 'toggle', pub: 0 },
  { k: 'default_admin_role',         v: 'admin', g: 'users_roles', t: 'text',   pub: 0 },
  { k: 'session_timeout_minutes',    v: '480',  g: 'users_roles', t: 'text',   pub: 0 },
  { k: 'two_factor_enabled',         v: '0',   g: 'users_roles', t: 'toggle', pub: 0 },
  // security
  { k: 'maintenance_enabled',      v: '0',  g: 'security', t: 'toggle',   pub: 1 },
  { k: 'maintenance_message',      v: 'We are currently undergoing maintenance. Please check back shortly.', g: 'security', t: 'textarea', pub: 1 },
  { k: 'admin_ip_whitelist',       v: '',   g: 'security', t: 'textarea', pub: 0 },
  { k: 'rate_limit_enabled',       v: '1',  g: 'security', t: 'toggle',   pub: 0 },
  { k: 'captcha_enabled',          v: '0',  g: 'security', t: 'toggle',   pub: 0 },
  { k: 'captcha_site_key',         v: '',   g: 'security', t: 'text',     pub: 0 },
  { k: 'captcha_secret_key',       v: '',   g: 'security', t: 'password', pub: 0, sec: 1 },
  // backup
  { k: 'auto_backup_enabled',    v: '0',    g: 'backup', t: 'toggle', pub: 0 },
  { k: 'backup_frequency',       v: 'daily', g: 'backup', t: 'text',   pub: 0 },
  { k: 'backup_email',           v: '',     g: 'backup', t: 'email',  pub: 0 },
  { k: 'last_backup_at',         v: '',     g: 'backup', t: 'text',   pub: 0 },
  // logs
  { k: 'log_retention_days',     v: '90', g: 'logs', t: 'text',   pub: 0 },
  { k: 'activity_logs_enabled',  v: '1',  g: 'logs', t: 'toggle', pub: 0 },
  { k: 'email_logs_enabled',     v: '1',  g: 'logs', t: 'toggle', pub: 0 },
  { k: 'payment_logs_enabled',   v: '1',  g: 'logs', t: 'toggle', pub: 0 },
];

const seedSettings = async () => {
  for (const s of SEED) {
    await executeQuery(
      `INSERT IGNORE INTO site_settings (setting_key, setting_value, setting_group, input_type, is_public, is_secret, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [s.k, s.v, s.g, s.t, s.pub ?? 0, s.sec ?? 0, 0]
    );
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const maskRow = (row) => ({
  ...row,
  setting_value: row.is_secret ? MASK : row.setting_value,
});

const logChange = async (req, key, oldVal, newVal, action = 'update') => {
  try {
    const adminId = req.user?.id || null;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    const ua = req.headers['user-agent'] || null;
    await executeQuery(
      `INSERT INTO settings_logs (admin_id, setting_key, old_value, new_value, action, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [adminId, key, oldVal, newVal, action, ip, ua]
    );
  } catch {}
};

// ─── Init ─────────────────────────────────────────────────────────────────────
let initialised = false;
const init = async () => {
  if (initialised) return;
  initialised = true;
  await ensureTables();
  await seedSettings();
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// GET /api/site-settings/public — no auth, is_public only, no secrets
const getPublic = async (req, res) => {
  try {
    await init();
    const rows = await executeQuery(
      "SELECT setting_key, setting_value FROM site_settings WHERE is_public = 1 AND is_secret = 0"
    );
    const data = {};
    rows.forEach(r => { data[r.setting_key] = r.setting_value; });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/site-settings — all, secrets masked
const getAll = async (req, res) => {
  try {
    await init();
    const rows = await executeQuery(
      "SELECT * FROM site_settings ORDER BY setting_group, sort_order, setting_key"
    );
    const grouped = {};
    rows.forEach(r => {
      const g = r.setting_group;
      if (!grouped[g]) grouped[g] = {};
      grouped[g][r.setting_key] = maskRow(r);
    });
    res.json({ success: true, data: grouped });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/site-settings/group/:group
const getGroup = async (req, res) => {
  try {
    await init();
    const rows = await executeQuery(
      "SELECT * FROM site_settings WHERE setting_group = ? ORDER BY sort_order, setting_key",
      [req.params.group]
    );
    const data = {};
    rows.forEach(r => { data[r.setting_key] = maskRow(r); });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/site-settings — bulk update { settings: { key: value, ... } }
const updateSettings = async (req, res) => {
  try {
    await init();
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'settings object required' });
    }
    for (const [key, value] of Object.entries(settings)) {
      const existing = await executeQuery(
        "SELECT setting_value, is_secret FROM site_settings WHERE setting_key = ?", [key]
      );
      if (!existing.length) continue;
      const row = existing[0];
      // Never overwrite secret with mask or empty
      if (row.is_secret && (!value || value === MASK)) continue;
      const oldVal = row.is_secret ? MASK : row.setting_value;
      const newVal = row.is_secret ? MASK : value;
      await executeQuery(
        "UPDATE site_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?",
        [value, key]
      );
      await logChange(req, key, oldVal, newVal);
    }
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (e) {
    console.error('Update settings error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/site-settings/test-mail
const testMail = async (req, res) => {
  try {
    await init();
    const keys = ['smtp_enabled','smtp_host','smtp_port','smtp_secure','smtp_user','smtp_password','mail_from_name','mail_from_email','admin_notification_email'];
    const rows = await executeQuery(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
      keys
    );
    const cfg = {};
    rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });

    if (!toBool(cfg.smtp_enabled)) {
      return res.json({ success: false, message: 'SMTP is not enabled. Please turn on SMTP Enabled in Email / SMTP settings and save.' });
    }
    if (!cfg.smtp_host || !cfg.smtp_port) {
      return res.json({ success: false, message: 'SMTP configuration is incomplete. Please check host and port.' });
    }
    if (!cfg.smtp_user || !cfg.smtp_password) {
      return res.json({ success: false, message: 'SMTP username and password are required.' });
    }

    const to = req.body?.to || cfg.admin_notification_email;
    if (!to) {
      return res.json({ success: false, message: 'No recipient email. Please set Admin Notification Email in settings.' });
    }

    const port = parseInt(cfg.smtp_port) || 587;
    const secure = toBool(cfg.smtp_secure);

    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: cfg.smtp_host,
        port,
        secure,
        auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
      });
      await transporter.sendMail({
        from: `"${cfg.mail_from_name || 'Big Bean Café'}" <${cfg.mail_from_email || cfg.smtp_user}>`,
        to,
        subject: 'Big Bean Café SMTP Test',
        html: `<div style="font-family:Arial,sans-serif;padding:24px;">
          <h2 style="color:#3D1F0D;">Big Bean Café ☕</h2>
          <p>Your Big Bean Café SMTP email settings are working successfully.</p>
          <p style="color:#9b6b50;font-size:12px;">Host: ${cfg.smtp_host} | Port: ${port} | Secure: ${secure}</p>
        </div>`,
      });
      // Log success
      try { await executeQuery('INSERT INTO email_logs (module_name, recipient_email, subject, status) VALUES (?,?,?,?)', ['test', to, 'Big Bean Café SMTP Test', 'sent']); } catch {}
      res.json({ success: true, message: `Test email sent successfully to ${to}` });
    } catch (mailErr) {
      // Log failure
      try { await executeQuery('INSERT INTO email_logs (module_name, recipient_email, subject, status, error_message) VALUES (?,?,?,?,?)', ['test', to, 'Big Bean Café SMTP Test', 'failed', mailErr.message]); } catch {}
      // Friendly error classification
      const msg = mailErr.message || '';
      if (msg.includes('Invalid login') || msg.includes('Username and Password') || msg.includes('535') || msg.includes('auth')) {
        return res.json({ success: false, message: 'SMTP login failed. For Gmail, use an App Password (not your normal Gmail password). Go to Google Account → Security → App passwords.' });
      }
      if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
        return res.json({ success: false, message: `SMTP connection failed. Please check host (${cfg.smtp_host}) and port (${port}). Error: ${msg}` });
      }
      if (msg.includes('self signed') || msg.includes('certificate')) {
        return res.json({ success: false, message: 'SSL certificate error. Try setting SMTP Secure to false and Port to 587.' });
      }
      res.json({ success: false, message: `Mail error: ${msg}` });
    }
  } catch (e) {
    console.error('testMail error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/site-settings/test-sms
const testSms = async (req, res) => {
  try {
    await init();
    const row = await executeQuery(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'sms_enabled'"
    );
    if (!row.length || row[0].setting_value !== '1') {
      return res.json({ success: false, message: 'SMS is not enabled.' });
    }
    res.json({ success: false, message: 'SMS provider integration coming soon. Settings saved.' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/site-settings/test-payment
const testPayment = async (req, res) => {
  return require('./paymentController').testOrder(req, res);
};

// GET /api/site-settings/logs
const getLogs = async (req, res) => {
  try {
    await init();
    let logs;
    try {
      logs = await executeQuery(
        "SELECT l.*, a.name AS admin_name FROM settings_logs l LEFT JOIN admins a ON l.admin_id = a.id ORDER BY l.created_at DESC LIMIT 100"
      );
    } catch {
      logs = await executeQuery(
        "SELECT * FROM settings_logs ORDER BY created_at DESC LIMIT 100"
      );
    }
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/site-settings/backup
const backup = async (req, res) => {
  try {
    await init();
    const settings = await executeQuery(
      "SELECT setting_key, setting_value, setting_group, input_type, is_public, is_secret FROM site_settings ORDER BY setting_group, setting_key"
    );
    const maskedSettings = settings.map(r => ({
      ...r, setting_value: r.is_secret ? '[REDACTED]' : r.setting_value,
    }));
    const logs = await executeQuery(
      "SELECT * FROM settings_logs ORDER BY created_at DESC LIMIT 500"
    );
    await logChange(req, 'BACKUP', null, null, 'backup');
    res.json({
      success: true,
      data: { exported_at: new Date().toISOString(), settings: maskedSettings, logs },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getPublic, getAll, getGroup, updateSettings, testMail, testSms, testPayment, getLogs, backup };
