const { executeQuery } = require('../config/database');
const { sendAdminEmailReply, sendAdminWhatsAppReply, getLogs } = require('../services/adminReplyService');
const { getTemplate, applyVars } = require('../services/replyTemplates');
const { createAdminNotification } = require('../services/adminNotificationService');
const { getDataScopeFilter } = require('../middleware/authMiddleware');

const MODULE = 'contact_enquiries';

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS contact_enquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NULL,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'general',
      message TEXT NOT NULL,
      priority VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(80) NOT NULL DEFAULT 'new',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

// Migrate status column: ENUM → VARCHAR, add updated_at if missing
const ensureContactSchema = async () => {
  try {
    // Fix status column type
    const sc = await executeQuery("SHOW COLUMNS FROM contact_enquiries LIKE 'status'");
    if (!sc.length) {
      await executeQuery("ALTER TABLE contact_enquiries ADD COLUMN status VARCHAR(80) NOT NULL DEFAULT 'new'");
    } else {
      const colType = String(sc[0].Type || '').toLowerCase();
      if (colType.startsWith('enum') || colType === 'varchar(50)') {
        await executeQuery("ALTER TABLE contact_enquiries MODIFY COLUMN status VARCHAR(80) NOT NULL DEFAULT 'new'");
        // Normalize legacy values
        await executeQuery("UPDATE contact_enquiries SET status='new' WHERE status IS NULL OR status='' OR status='pending'");
        await executeQuery("UPDATE contact_enquiries SET status='replied' WHERE status IN ('reply','responded','in_progress')");
        await executeQuery("UPDATE contact_enquiries SET status='follow_up' WHERE status IN ('followup','follow-up')");
        await executeQuery("UPDATE contact_enquiries SET status='resolved' WHERE status IN ('complete','completed')");
      }
    }
    // Add updated_at if missing
    const ua = await executeQuery("SHOW COLUMNS FROM contact_enquiries LIKE 'updated_at'");
    if (!ua.length) {
      await executeQuery("ALTER TABLE contact_enquiries ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }
  } catch (e) {
    console.warn('contact_enquiries schema migration:', e.message);
  }
};

const STATUS_ALIAS_MAP = {
  new: 'new', pending: 'new',
  replied: 'replied', reply: 'replied', responded: 'replied', in_progress: 'replied',
  follow_up: 'follow_up', followup: 'follow_up',
  resolved: 'resolved', completed: 'resolved', complete: 'resolved',
  closed: 'closed',
  spam: 'spam',
};

const normalizeContactStatus = (value) => {
  const clean = String(value || '').toLowerCase().trim().replace(/[\s\-]+/g, '_');
  return STATUS_ALIAS_MAP[clean] || '';
};

// Create new contact enquiry
const createContactEnquiry = async (req, res) => {
  try {
    await ensureTable();
    await ensureContactSchema();
    
    // Support both snake_case and camelCase
    const { 
      full_name, fullName, name,
      phone, phone_number, phoneNumber,
      email,
      enquiry_type, enquiryType, subject,
      preferred_outlet, preferredOutlet,
      message
    } = req.body;
    
    const finalName = full_name || fullName || name;
    const finalPhone = phone || phone_number || phoneNumber;
    const finalEmail = email;
    const finalSubject = subject || enquiry_type || enquiryType || 'General Enquiry';
    const finalCategory = (enquiry_type || enquiryType || 'general').toLowerCase().replace(/\s+/g, '_');
    const finalPreferredOutlet = preferred_outlet || preferredOutlet;
    const finalMessage = finalPreferredOutlet 
      ? `${message || ''}\n\nPreferred Outlet: ${finalPreferredOutlet}` 
      : (message || '');
    
    // Validation
    if (!finalName || (!finalPhone && !finalEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Full name and at least one contact method (phone or email) are required'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO contact_enquiries (
        name, email, phone, subject, message
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        finalName, finalEmail, finalPhone, finalSubject, finalMessage
      ]
    );

    // Create admin notification for new contact enquiry
    createAdminNotification({
      type: 'contact_enquiry',
      title: 'New Contact Enquiry',
      message: `New enquiry from ${finalName}: ${finalSubject}`,
      module_name: 'contact_enquiries',
      record_id: result.insertId,
      action_url: `/admin/contact-enquiries/${result.insertId}`,
      priority: 'normal',
      created_by_type: 'guest',
      created_by_id: null,
      metadata: { name: finalName, email: finalEmail, phone: finalPhone, subject: finalSubject }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Thank you! Our team will contact you shortly.',
      data: { id: result.insertId }
    });
    
  } catch (error) {
    console.error('Create contact enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to submit enquiry. Please try again.'
    });
  }
};

// Get all contact enquiries
const getAllContactEnquiries = async (req, res) => {
  try {
    await ensureTable();
    await ensureContactSchema();
    const { status, search } = req.query;
    
    let query = 'SELECT ce.* FROM contact_enquiries ce';
    const params = [];
    const whereConditions = [];

    if (status && status !== 'all') {
      whereConditions.push('ce.status = ?');
      params.push(status);
    }

    if (search) {
      whereConditions.push('(ce.name LIKE ? OR ce.email LIKE ? OR ce.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const scope = await getDataScopeFilter(req.admin || req.user, 'contact_enquiries', 'ce');
    if (scope.clause) {
      whereConditions.push(scope.clause);
      params.push(...scope.params);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY ce.created_at DESC';
    
    const enquiries = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: enquiries
    });
    
  } catch (error) {
    console.error('Get all contact enquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// Get contact enquiry by ID
const getContactEnquiryById = async (req, res) => {
  try {
    await ensureTable();
    await ensureContactSchema();
    const { id } = req.params;
    
    const enquiry = await executeQuery(
      'SELECT * FROM contact_enquiries WHERE id = ?',
      [id]
    );
    
    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found'
      });
    }
    
    res.json({
      success: true,
      data: enquiry[0]
    });
    
  } catch (error) {
    console.error('Get contact enquiry by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// Update contact enquiry (full update: status + notes)
const VALID_STATUSES = ['new','replied','follow_up','resolved','closed','spam'];

const updateContactEnquiry = async (req, res) => {
  try {
    await ensureTable();
    await ensureContactSchema();
    const { id } = req.params;
    const { status, notes } = req.body;
    const final = normalizeContactStatus(status);
    if (!final) return res.status(400).json({ success: false, message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    const existingEnquiry = await executeQuery('SELECT id FROM contact_enquiries WHERE id = ?', [id]);
    if (existingEnquiry.length === 0) return res.status(404).json({ success: false, message: 'Contact enquiry not found' });
    try {
      await executeQuery(
        'UPDATE contact_enquiries SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [final, notes || null, id]
      );
    } catch (upErr) {
      // updated_at column may not exist on very old schema — retry without it
      if (String(upErr.message).includes('updated_at')) {
        await executeQuery('UPDATE contact_enquiries SET status = ?, notes = ? WHERE id = ?', [final, notes || null, id]);
      } else { throw upErr; }
    }
    res.json({ success: true, message: 'Contact enquiry updated successfully' });
  } catch (error) {
    console.error('Update contact enquiry error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// Dedicated status-only update (PUT /:id/status)
const updateStatus = async (req, res) => {
  try {
    await ensureTable();
    await ensureContactSchema();
    const { id } = req.params;
    const raw = req.body.status || req.body.order_status || '';
    const final = normalizeContactStatus(raw);
    if (!final) {
      return res.status(400).json({
        success: false,
        message: `Invalid status "${raw}". Valid values: ${VALID_STATUSES.join(', ')}`
      });
    }
    const existing = await executeQuery('SELECT id FROM contact_enquiries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Contact enquiry not found' });
    try {
      await executeQuery(
        'UPDATE contact_enquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [final, id]
      );
    } catch (upErr) {
      if (String(upErr.message).includes('updated_at')) {
        await executeQuery('UPDATE contact_enquiries SET status = ? WHERE id = ?', [final, id]);
      } else { throw upErr; }
    }
    res.json({ success: true, message: 'Contact enquiry status updated successfully' });
  } catch (error) {
    console.error('updateStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status. Please try again.' });
  }
};

const sendEmail = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM contact_enquiries WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const r = rows[0];
    const name = r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key);
    const vars = { name, email: r.email, phone: r.phone || '', subject: r.subject, status: r.status };
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
    const rows = await executeQuery('SELECT * FROM contact_enquiries WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const r = rows[0];
    const name = r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key);
    const vars = { name, phone: r.phone || '', status: r.status };
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

// Delete contact enquiry
const deleteContactEnquiry = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    
    const existingEnquiry = await executeQuery(
      'SELECT id FROM contact_enquiries WHERE id = ?',
      [id]
    );
    
    if (existingEnquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM contact_enquiries WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Contact enquiry deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete contact enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

module.exports = {
  createContactEnquiry,
  getAllContactEnquiries,
  getContactEnquiryById,
  updateContactEnquiry,
  updateStatus,
  sendEmail,
  sendWhatsApp,
  getCommLogs,
  deleteContactEnquiry
};
