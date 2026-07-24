const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { sendAdminEmailReply, sendAdminWhatsAppReply, getLogs } = require('../services/adminReplyService');
const { getTemplate, applyVars } = require('../services/replyTemplates');
const { createAdminNotification } = require('../services/adminNotificationService');

const MODULE = 'career_applications';

let tableReady = false;
let migrationDone = false;

const ensureTable = async () => {
  if (tableReady) return;
  // Create table with new schema if it doesn't exist
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS career_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id INT NULL,
      job_title VARCHAR(255) NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      experience TEXT NULL,
      education TEXT NULL,
      skills TEXT NULL,
      expected_salary VARCHAR(100) NULL,
      notice_period VARCHAR(100) NULL,
      cover_letter TEXT NULL,
      resume_file VARCHAR(500) NULL,
      status ENUM('new','reviewed','shortlisted','rejected','hired') DEFAULT 'new',
      admin_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Migration: add missing columns if table existed with old schema
  const cols = await executeQuery(`SHOW COLUMNS FROM career_applications`);
  const colNames = cols.map(c => c.Field);

  // Add job_id FIRST (before job_title which depends on it)
  if (!colNames.includes('job_id')) {
    try { await executeQuery(`ALTER TABLE career_applications ADD COLUMN job_id INT NULL AFTER id`); } catch (e) { console.warn('job_id add:', e.message); }
  }
  if (!colNames.includes('job_title')) {
    try {
      await executeQuery(`ALTER TABLE career_applications ADD COLUMN job_title VARCHAR(255) NULL`);
      if (colNames.includes('position')) {
        await executeQuery(`UPDATE career_applications SET job_title = position WHERE job_title IS NULL`);
      }
    } catch (e) { console.warn('job_title add:', e.message); }
  }
  if (!colNames.includes('full_name')) {
    try {
      await executeQuery(`ALTER TABLE career_applications ADD COLUMN full_name VARCHAR(150) NULL`);
      if (colNames.includes('name')) {
        await executeQuery(`UPDATE career_applications SET full_name = name WHERE full_name IS NULL`);
      }
    } catch (e) { console.warn('full_name add:', e.message); }
  }
  if (!colNames.includes('resume_file')) {
    try {
      await executeQuery(`ALTER TABLE career_applications ADD COLUMN resume_file VARCHAR(500) NULL`);
      if (colNames.includes('resume_path')) {
        await executeQuery(`UPDATE career_applications SET resume_file = resume_path WHERE resume_file IS NULL`);
      }
    } catch (e) { console.warn('resume_file add:', e.message); }
  }
  if (!colNames.includes('admin_notes'))    { try { await executeQuery(`ALTER TABLE career_applications ADD COLUMN admin_notes TEXT NULL`); } catch (e) { console.warn('admin_notes:', e.message); } }
  if (!colNames.includes('education'))      { try { await executeQuery(`ALTER TABLE career_applications ADD COLUMN education TEXT NULL`); } catch (e) { console.warn('education:', e.message); } }
  if (!colNames.includes('skills'))         { try { await executeQuery(`ALTER TABLE career_applications ADD COLUMN skills TEXT NULL`); } catch (e) { console.warn('skills:', e.message); } }
  if (!colNames.includes('expected_salary')){ try { await executeQuery(`ALTER TABLE career_applications ADD COLUMN expected_salary VARCHAR(100) NULL`); } catch (e) { console.warn('expected_salary:', e.message); } }
  if (!colNames.includes('notice_period'))  { try { await executeQuery(`ALTER TABLE career_applications ADD COLUMN notice_period VARCHAR(100) NULL`); } catch (e) { console.warn('notice_period:', e.message); } }
  if (!colNames.includes('cover_letter'))   { try { await executeQuery(`ALTER TABLE career_applications ADD COLUMN cover_letter TEXT NULL`); } catch (e) { console.warn('cover_letter:', e.message); } }

  // Make old NOT NULL columns nullable so new INSERTs don't require them
  if (colNames.includes('position')) {
    try { await executeQuery(`ALTER TABLE career_applications MODIFY COLUMN position VARCHAR(255) NULL DEFAULT NULL`); } catch (e) { console.warn('position nullable:', e.message); }
  }
  if (colNames.includes('name')) {
    try { await executeQuery(`ALTER TABLE career_applications MODIFY COLUMN name VARCHAR(255) NULL DEFAULT NULL`); } catch (e) { console.warn('name nullable:', e.message); }
  }
  if (colNames.includes('resume_path')) {
    try { await executeQuery(`ALTER TABLE career_applications MODIFY COLUMN resume_path VARCHAR(500) NULL DEFAULT NULL`); } catch (e) { console.warn('resume_path nullable:', e.message); }
  }

  tableReady = true;
};

const ensureMigration = async () => {
  if (migrationDone) return;
  try {
    const sc = await executeQuery("SHOW COLUMNS FROM career_applications LIKE 'status'");
    if (sc.length && sc[0].Type && sc[0].Type.toLowerCase().startsWith('enum')) {
      await executeQuery("ALTER TABLE career_applications MODIFY COLUMN status VARCHAR(80) NOT NULL DEFAULT 'new'");
      await executeQuery("UPDATE career_applications SET status='new' WHERE status IS NULL OR status=''");
    }
  } catch (e) { console.warn('career status migration:', e.message); }
  migrationDone = true;
};

const submit = async (req, res) => {
  try {
    await ensureTable();
    const body = req.body;

    // Accept both new field names and legacy aliases
    const full_name    = body.full_name    || body.name        || '';
    const job_title    = body.job_title    || body.jobTitle    || '';
    const job_id       = body.job_id       || '';
    const email        = body.email        || '';
    const phone        = body.phone        || '';
    const experience   = body.experience   || '';
    const education    = body.education    || '';
    const skills       = body.skills       || '';
    const expected_salary  = body.expected_salary  || body.expectedSalary  || '';
    const notice_period    = body.notice_period    || body.noticePeriod    || '';
    const cover_letter     = body.cover_letter     || body.coverLetter     || '';

    if (!full_name.trim()) return res.status(400).json({ success: false, message: 'Full name is required.' });
    if (!email.trim())     return res.status(400).json({ success: false, message: 'Email is required.' });
    if (!phone.trim())     return res.status(400).json({ success: false, message: 'Phone is required.' });

    const resumePath = req.file ? `uploads/careers/resumes/${req.file.filename}` : null;

    const result = await executeQuery(`
      INSERT INTO career_applications
        (job_id, job_title, full_name, email, phone,
         experience, education, skills,
         expected_salary, notice_period, cover_letter, resume_file, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'new')
    `, [
      job_id.trim() || null, job_title.trim() || null, full_name.trim(), email.trim(), phone.trim(),
      experience.trim() || null, education.trim() || null, skills.trim() || null,
      expected_salary.trim() || null, notice_period.trim() || null, cover_letter.trim() || null,
      resumePath
    ]);

    // Create admin notification for new career application
    createAdminNotification({
      type: 'career_application',
      title: 'New Career Application',
      message: `New application from ${full_name.trim()} for ${job_title.trim() || 'a position'}`,
      module_name: 'career_applications',
      record_id: result.insertId,
      action_url: `/admin/career-applications/${result.insertId}`,
      priority: 'normal',
      created_by_type: 'guest',
      created_by_id: null,
      metadata: { full_name: full_name.trim(), email: email.trim(), job_title: job_title.trim() }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. Our HR team will contact you shortly.'
    });
  } catch (error) {
    console.error('Submit career application error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit application. Please try again.' });
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const { search, status } = req.query;
    let query = 'SELECT * FROM career_applications WHERE 1=1';
    const params = [];
    if (search) {
      query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR job_title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    const rows = await executeQuery(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get career applications error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM career_applications WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get career application by id error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const VALID_STATUSES = ['new','reviewed','shortlisted','interview_scheduled','selected','rejected','on_hold'];

const updateStatus = async (req, res) => {
  try {
    await ensureTable();
    await ensureMigration();
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    const norm = String(status || '').toLowerCase().replace(/\s+/g,'_');
    // hired -> selected alias
    const aliased = norm === 'hired' ? 'selected' : norm;
    const final = VALID_STATUSES.includes(aliased) ? aliased : null;
    if (!final) return res.status(400).json({ success: false, message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    const existing = await executeQuery('SELECT id FROM career_applications WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Application not found' });
    await executeQuery(
      'UPDATE career_applications SET status=?, admin_notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [final, admin_notes || null, id]
    );
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const sendEmail = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM career_applications WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Application not found' });
    const r = rows[0];
    const name = r.full_name || r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key || r.status);
    const vars = { name, position: r.job_title || r.position || 'the position', email: r.email, phone: r.phone, status: r.status };
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
    const rows = await executeQuery('SELECT * FROM career_applications WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Application not found' });
    const r = rows[0];
    const name = r.full_name || r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key || r.status);
    const vars = { name, position: r.job_title || r.position || 'the position', phone: r.phone, status: r.status };
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

const deleteApplication = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM career_applications WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Application not found' });

    if (existing[0].resume_file) {
      const fp = path.join(__dirname, '../', existing[0].resume_file);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    await executeQuery('DELETE FROM career_applications WHERE id=?', [id]);
    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Delete career application error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { submit, getAll, getById, updateStatus, sendEmail, sendWhatsApp, getCommLogs, deleteApplication };
