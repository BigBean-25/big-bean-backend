const { executeQuery } = require('../config/database');
const { sendAdminEmailReply, sendAdminWhatsAppReply, getLogs } = require('../services/adminReplyService');
const { getTemplate, applyVars } = require('../services/replyTemplates');
const { createAdminNotification } = require('../services/adminNotificationService');
const { getDataScopeFilter } = require('../middleware/authMiddleware');

const MODULE = 'franchise_enquiries';

let migrationDone = false;

const ensureMigration = async () => {
  if (migrationDone) return;
  try {
    const sc = await executeQuery("SHOW COLUMNS FROM franchise_enquiries LIKE 'status'");
    if (sc.length && sc[0].Type && sc[0].Type.toLowerCase().startsWith('enum')) {
      await executeQuery("ALTER TABLE franchise_enquiries MODIFY COLUMN status VARCHAR(80) NOT NULL DEFAULT 'new'");
      await executeQuery("UPDATE franchise_enquiries SET status='new' WHERE status IS NULL OR status=''");
    }
  } catch (e) { console.warn('franchise status migration:', e.message); }
  migrationDone = true;
};

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS franchise_enquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      investment_range VARCHAR(100) NULL,
      preferred_location TEXT NULL,
      business_experience TEXT NULL,
      message TEXT NULL,
      status ENUM('new','contacted','qualified','rejected','converted') DEFAULT 'new',
      admin_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const cols = await executeQuery(`SHOW COLUMNS FROM franchise_enquiries`);
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('full_name')) {
    try {
      await executeQuery(`ALTER TABLE franchise_enquiries ADD COLUMN full_name VARCHAR(150) NULL`);
      if (colNames.includes('name')) {
        await executeQuery(`UPDATE franchise_enquiries SET full_name = name WHERE full_name IS NULL`);
      }
    } catch (e) { console.warn('full_name add:', e.message); }
  }
  if (!colNames.includes('investment_range')) {
    try {
      await executeQuery(`ALTER TABLE franchise_enquiries ADD COLUMN investment_range VARCHAR(100) NULL`);
      if (colNames.includes('investment')) {
        await executeQuery(`UPDATE franchise_enquiries SET investment_range = investment WHERE investment_range IS NULL`);
      }
    } catch (e) { console.warn('investment_range add:', e.message); }
  }
  if (!colNames.includes('preferred_location'))  { try { await executeQuery(`ALTER TABLE franchise_enquiries ADD COLUMN preferred_location TEXT NULL`); } catch (e) { console.warn(e.message); } }
  if (!colNames.includes('business_experience')) { try { await executeQuery(`ALTER TABLE franchise_enquiries ADD COLUMN business_experience TEXT NULL`); } catch (e) { console.warn(e.message); } }
  if (!colNames.includes('admin_notes'))         { try { await executeQuery(`ALTER TABLE franchise_enquiries ADD COLUMN admin_notes TEXT NULL`); } catch (e) { console.warn(e.message); } }
  if (!colNames.includes('state'))               { try { await executeQuery(`ALTER TABLE franchise_enquiries ADD COLUMN state VARCHAR(100) NULL`); } catch (e) { console.warn(e.message); } }
  if (!colNames.includes('city'))                { try { await executeQuery(`ALTER TABLE franchise_enquiries ADD COLUMN city VARCHAR(100) NULL`); } catch (e) { console.warn(e.message); } }

  if (colNames.includes('name'))       { try { await executeQuery(`ALTER TABLE franchise_enquiries MODIFY COLUMN name VARCHAR(150) NULL DEFAULT NULL`); } catch (e) { console.warn(e.message); } }
  if (colNames.includes('investment')) { try { await executeQuery(`ALTER TABLE franchise_enquiries MODIFY COLUMN investment VARCHAR(100) NULL DEFAULT NULL`); } catch (e) { console.warn(e.message); } }

};

const submit = async (req, res) => {
  try {
    await ensureTable();
    const body = req.body;

    const full_name           = (body.full_name || body.name || '').trim();
    const email               = (body.email || '').trim();
    const phone               = (body.phone || '').trim();
    const city                = (body.city || '').trim();
    const state               = (body.state || '').trim();
    const investment_range    = (body.investment_range || body.investmentRange || '').trim() || null;
    const preferred_location  = (body.preferred_location || body.preferredLocation || '').trim() || null;
    const business_experience = (body.business_experience || body.experience || '').trim() || null;
    const message             = (body.message || '').trim() || null;

    if (!full_name) return res.status(400).json({ success: false, message: 'Full name is required.' });
    if (!email)     return res.status(400).json({ success: false, message: 'Email is required.' });
    if (!phone)     return res.status(400).json({ success: false, message: 'Phone is required.' });
    if (!city)      return res.status(400).json({ success: false, message: 'City is required.' });
    if (!state)     return res.status(400).json({ success: false, message: 'State is required.' });

    const result = await executeQuery(`
      INSERT INTO franchise_enquiries
        (full_name, email, phone, city, state,
         investment_range, preferred_location, business_experience, message, status)
      VALUES (?,?,?,?,?,?,?,?,?,'new')
    `, [full_name, email, phone, city, state, investment_range, preferred_location, business_experience, message]);

    // Create admin notification for new franchise enquiry
    createAdminNotification({
      type: 'franchise_enquiry',
      title: 'New Franchise Enquiry',
      message: `New franchise enquiry from ${full_name} in ${city}, ${state}`,
      module_name: 'franchise_enquiries',
      record_id: result.insertId,
      action_url: `/admin/franchise-enquiries/${result.insertId}`,
      priority: 'high',
      created_by_type: 'guest',
      created_by_id: null,
      metadata: { full_name, email, phone, city, state, investment_range }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Franchise enquiry submitted successfully. Our team will contact you within 48 hours.'
    });
  } catch (error) {
    console.error('Submit franchise enquiry error:', error);
    res.status(500).json({ success: false, message: 'Unable to submit franchise enquiry. Please try again.' });
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const { search, status } = req.query;
    let query = 'SELECT * FROM franchise_enquiries WHERE 1=1';
    const params = [];
    if (search) {
      query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR city LIKE ? OR state LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') { query += ' AND status=?'; params.push(status); }

    const scope = await getDataScopeFilter(req.admin || req.user, 'franchise_enquiries', 'franchise_enquiries');
    if (scope.clause) {
      query += ' AND ' + scope.clause;
      params.push(...scope.params);
    }

    query += ' ORDER BY created_at DESC';
    const rows = await executeQuery(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get franchise enquiries error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM franchise_enquiries WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get franchise enquiry by id error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const VALID_STATUSES = ['new','contacted','profile_review','meeting_scheduled','proposal_sent','converted','closed','rejected'];

const updateStatus = async (req, res) => {
  try {
    await ensureTable();
    await ensureMigration();
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    const norm = String(status || '').toLowerCase().replace(/\s+/g,'_');
    const final = VALID_STATUSES.includes(norm) ? norm : null;
    if (!final) return res.status(400).json({ success: false, message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    const existing = await executeQuery('SELECT id FROM franchise_enquiries WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    await executeQuery(
      'UPDATE franchise_enquiries SET status=?, admin_notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [final, admin_notes || null, id]
    );
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update franchise enquiry status error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const sendEmail = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM franchise_enquiries WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const r = rows[0];
    const name = r.full_name || r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key);
    const vars = { name, email: r.email, phone: r.phone, city: r.city, state: r.state, status: r.status };
    const applied = applyVars(tmpl, vars);
    const subject = req.body.subject || applied.subject;
    const message = req.body.message || applied.message;
    const result = await sendAdminEmailReply({ moduleName: MODULE, recordId: r.id, to: r.email, name, subject, message });
    res.status(result.success ? 200 : 400).json(result);
  } catch (e) {
    console.error('sendEmail error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const sendWhatsApp = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM franchise_enquiries WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const r = rows[0];
    const name = r.full_name || r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key);
    const vars = { name, phone: r.phone, city: r.city, status: r.status };
    const applied = applyVars(tmpl, vars);
    const message = req.body.message || applied.whatsapp;
    const result = await sendAdminWhatsAppReply({ moduleName: MODULE, recordId: r.id, phone: r.phone, name, message });
    res.json(result);
  } catch (e) {
    console.error('sendWhatsApp error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getCommLogs = async (req, res) => {
  try {
    const logs = await getLogs(MODULE, req.params.id);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

const deleteEnquiry = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM franchise_enquiries WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    await executeQuery('DELETE FROM franchise_enquiries WHERE id=?', [id]);
    res.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (error) {
    console.error('Delete franchise enquiry error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { submit, getAll, getById, updateStatus, sendEmail, sendWhatsApp, getCommLogs, deleteEnquiry };
