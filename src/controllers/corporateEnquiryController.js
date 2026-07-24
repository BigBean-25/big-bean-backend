const { executeQuery } = require('../config/database');
const { sendAdminEmailReply, sendAdminWhatsAppReply, getLogs } = require('../services/adminReplyService');
const { getTemplate, applyVars } = require('../services/replyTemplates');
const { createAdminNotification } = require('../services/adminNotificationService');
const { getDataScopeFilter } = require('../middleware/authMiddleware');

const MODULE = 'corporate_enquiries';

let tableReady = false;
let migrationDone = false;

const ensureTable = async () => {
  if (tableReady) return;
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS corporate_enquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(180) NOT NULL,
      contact_person VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      order_type VARCHAR(100) NULL,
      quantity VARCHAR(150) NULL,
      delivery_date DATE NULL,
      delivery_address TEXT NULL,
      budget_range VARCHAR(100) NULL,
      requirements TEXT NULL,
      status ENUM('new','contacted','quoted','confirmed','closed','rejected') DEFAULT 'new',
      admin_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const cols = await executeQuery('SHOW COLUMNS FROM corporate_enquiries');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('admin_notes')) {
    try { await executeQuery('ALTER TABLE corporate_enquiries ADD COLUMN admin_notes TEXT NULL'); } catch (e) { console.warn(e.message); }
  }
  if (!colNames.includes('updated_at')) {
    try { await executeQuery('ALTER TABLE corporate_enquiries ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'); } catch (e) { console.warn(e.message); }
  }

  tableReady = true;
};

const ensureMigration = async () => {
  if (migrationDone) return;
  try {
    const sc = await executeQuery("SHOW COLUMNS FROM corporate_enquiries LIKE 'status'");
    if (sc.length && sc[0].Type && sc[0].Type.toLowerCase().startsWith('enum')) {
      await executeQuery("ALTER TABLE corporate_enquiries MODIFY COLUMN status VARCHAR(80) NOT NULL DEFAULT 'new'");
      await executeQuery("UPDATE corporate_enquiries SET status='new' WHERE status IS NULL OR status=''");
    }
  } catch (e) { console.warn('corporate status migration:', e.message); }
  migrationDone = true;
};

const submit = async (req, res) => {
  try {
    await ensureTable();
    const b = req.body;
    const company_name    = (b.company_name || b.companyName || '').trim();
    const contact_person  = (b.contact_person || b.contactPerson || '').trim();
    const email           = (b.email || '').trim();
    const phone           = (b.phone || '').trim();
    const order_type      = (b.order_type || b.orderType || '').trim();
    const quantity        = (b.quantity || '').trim();
    const delivery_date   = (b.delivery_date || b.deliveryDate || null) || null;
    const delivery_address = (b.delivery_address || b.deliveryAddress || '').trim() || null;
    const budget_range    = (b.budget_range || b.budgetRange || '').trim() || null;
    const requirements    = (b.requirements || '').trim() || null;

    if (!company_name)   return res.status(400).json({ success: false, message: 'Company name is required' });
    if (!contact_person) return res.status(400).json({ success: false, message: 'Contact person is required' });
    if (!email)          return res.status(400).json({ success: false, message: 'Email is required' });
    if (!phone)          return res.status(400).json({ success: false, message: 'Phone is required' });
    if (!order_type)     return res.status(400).json({ success: false, message: 'Order type is required' });

    const result = await executeQuery(`
      INSERT INTO corporate_enquiries
        (company_name, contact_person, email, phone, order_type,
         quantity, delivery_date, delivery_address, budget_range, requirements, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,'new')
    `, [company_name, contact_person, email, phone, order_type,
        quantity || null, delivery_date, delivery_address, budget_range, requirements]);

    // Create admin notification for new corporate enquiry
    createAdminNotification({
      type: 'corporate_enquiry',
      title: 'New Corporate Enquiry',
      message: `New corporate enquiry from ${company_name} by ${contact_person}`,
      module_name: 'corporate_enquiries',
      record_id: result.insertId,
      action_url: `/admin/corporate-enquiries/${result.insertId}`,
      priority: 'high',
      created_by_type: 'guest',
      created_by_id: null,
      metadata: { company_name, contact_person, email, phone, order_type }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Corporate order enquiry submitted successfully. Our business team will contact you within 24 hours.'
    });
  } catch (e) {
    console.error('Submit corporate enquiry error:', e);
    res.status(500).json({ success: false, message: 'Unable to submit corporate enquiry. Please try again.' });
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const { search, status } = req.query;
    let sql = 'SELECT * FROM corporate_enquiries WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR phone LIKE ? OR order_type LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }

    const scope = await getDataScopeFilter(req.admin || req.user, 'corporate_enquiries', 'corporate_enquiries');
    if (scope.clause) {
      sql += ' AND ' + scope.clause;
      params.push(...scope.params);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await executeQuery(sql, params);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch enquiries' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM corporate_enquiries WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch enquiry' });
  }
};

const VALID_STATUSES = ['new','contacted','proposal_sent','follow_up','converted','closed','rejected'];

const updateStatus = async (req, res) => {
  try {
    await ensureTable();
    await ensureMigration();
    const { status, admin_notes } = req.body;
    // Accept any reasonable status (quoted -> proposal_sent etc.)
    const norm = String(status || '').toLowerCase().replace(/\s+/g,'_');
    const final = VALID_STATUSES.includes(norm) ? norm : (VALID_STATUSES.includes(status) ? status : null);
    if (!final) return res.status(400).json({ success: false, message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    const updates = ['status=?', 'updated_at=NOW()'];
    const params = [final];
    if (admin_notes !== undefined) { updates.push('admin_notes=?'); params.push(admin_notes); }
    params.push(req.params.id);
    await executeQuery(`UPDATE corporate_enquiries SET ${updates.join(',')} WHERE id=?`, params);
    res.json({ success: true, message: 'Status updated' });
  } catch (e) {
    console.error('updateStatus error:', e);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

const sendEmail = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM corporate_enquiries WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const r = rows[0];
    const name = r.contact_person || r.company_name;
    const tmpl = getTemplate(MODULE, req.body.template_key);
    const vars = { name, company: r.company_name, email: r.email, phone: r.phone, status: r.status };
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
    const rows = await executeQuery('SELECT * FROM corporate_enquiries WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const r = rows[0];
    const name = r.contact_person || r.company_name;
    const tmpl = getTemplate(MODULE, req.body.template_key);
    const vars = { name, company: r.company_name, phone: r.phone, status: r.status };
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
    await executeQuery('DELETE FROM corporate_enquiries WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Enquiry deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to delete enquiry' });
  }
};

module.exports = { submit, getAll, getById, updateStatus, sendEmail, sendWhatsApp, getCommLogs, deleteEnquiry };
