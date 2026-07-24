
const { executeQuery } = require('../config/database');

// GET /api/seo-pages/settings/public  — no auth
const getPublicSettings = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT setting_key, setting_value FROM seo_site_settings');
    const data = {};
    rows.forEach(r => { data[r.setting_key] = r.setting_value; });
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/seo-pages/settings  — admin
const getSettings = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT setting_key, setting_value FROM seo_site_settings ORDER BY setting_key');
    const data = {};
    rows.forEach(r => { data[r.setting_key] = r.setting_value; });
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/seo-pages/settings  — admin, body: { key: value, ... }
const updateSettings = async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await executeQuery(
        `INSERT INTO seo_site_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
        [key, value === '' ? null : value]
      );
    }
    res.json({ success: true, message: 'Settings saved' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getPublicSettings, getSettings, updateSettings };
