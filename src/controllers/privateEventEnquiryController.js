const { executeQuery } = require('../config/database');
const { createAdminNotification } = require('../services/adminNotificationService');
const { getDataScopeFilter } = require('../middleware/authMiddleware');
const { sendAdminEmailReply } = require('../services/adminReplyService');

const MODULE = 'private_event_enquiries';

let ensured = false;

const ensureTable = async () => {
  if (ensured) return;
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS private_event_enquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      enquiry_reference VARCHAR(40) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(255) NULL,
      outlet_id INT NULL,
      outlet_slug VARCHAR(120) NULL,
      outlet_name VARCHAR(255) NULL,
      occasion VARCHAR(120) NOT NULL,
      event_date DATE NULL,
      date_not_decided TINYINT(1) NOT NULL DEFAULT 0,
      preferred_time VARCHAR(50) NULL,
      duration VARCHAR(80) NULL,
      guest_count INT NULL,
      food_preferences TEXT NULL,
      requirements TEXT NULL,
      venue_visit_requested TINYINT(1) NOT NULL DEFAULT 0,
      enquiry_intent VARCHAR(40) NOT NULL DEFAULT 'general',
      consent TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'new',
      assigned_to INT NULL,
      admin_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pe_reference (enquiry_reference),
      KEY idx_pe_status (status),
      KEY idx_pe_outlet (outlet_slug),
      KEY idx_pe_occasion (occasion),
      KEY idx_pe_created (created_at)
    )
  `);

  // Seed permission rows so the module appears under Roles & Permissions
  for (const action of ['view', 'create', 'edit', 'delete', 'export']) {
    const permKey = `private_event_enquiries.${action}`;
    await executeQuery(
      `INSERT IGNORE INTO admin_permissions
        (module_key, module_name, permission_key, permission_name, permission_group, sort_order)
       VALUES ('private_event_enquiries', 'Private Event Enquiries', ?, ?, 'enquiries', 0)`,
      [permKey, `Private Event Enquiries ${action.charAt(0).toUpperCase() + action.slice(1)}`]
    );
  }
  const superRole = await executeQuery("SELECT id FROM admin_roles WHERE role_key = 'super_admin' LIMIT 1");
  if (superRole.length) {
    const permRows = await executeQuery(
      "SELECT id FROM admin_permissions WHERE module_key = 'private_event_enquiries'"
    );
    for (const p of permRows) {
      await executeQuery(
        `INSERT IGNORE INTO admin_role_permissions
          (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_export)
         VALUES (?, ?, 1, 1, 1, 1, 1)`,
        [superRole[0].id, p.id]
      );
    }
  }
  ensured = true;
};

const clean = (v, max = 500) =>
  typeof v === 'string' ? v.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, max) : null;

const OCCASIONS = new Set([
  'birthday', 'anniversary', 'family', 'reunion', 'corporate', 'farewell',
  'baby-shower', 'engagement', 'workshop', 'group-dining', 'other',
]);

const INTENTS = new Set(['general', 'quote', 'venue-visit']);

// The cafe operates on the Bengaluru business calendar (Asia/Kolkata) — never
// derive "today" from the server's local/UTC date, which rolls over at the
// wrong moment for IST.
const todayInBengaluru = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// Human-readable public reference: BBC-PE-YYYYMMDD-XXXX
const generateReference = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let i = 0; i < 6; i++) {
    let suffix = '';
    for (let j = 0; j < 4; j++) suffix += chars[Math.floor(Math.random() * chars.length)];
    const ref = `BBC-PE-${date}-${suffix}`;
    const dup = await executeQuery('SELECT id FROM private_event_enquiries WHERE enquiry_reference = ?', [ref]);
    if (!dup.length) return ref;
  }
  return `BBC-PE-${date}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
};

const PUBLIC_STATUSES = ['new', 'contacted', 'qualified', 'quote_sent', 'confirmed', 'closed'];

const OCCASION_LABELS = {
  birthday: 'birthday party', anniversary: 'anniversary', family: 'family get-together',
  reunion: 'friends / reunion', corporate: 'corporate / team event', farewell: 'farewell / office celebration',
  'baby-shower': 'baby shower', engagement: 'engagement / pre-wedding', workshop: 'workshop / meetup',
  'group-dining': 'group lunch / dinner', other: 'event',
};

// ── Public: create enquiry ──────────────────────────────────────────
const createEnquiry = async (req, res) => {
  try {
    await ensureTable();
    const b = req.body || {};

    // Honeypot — bots fill hidden fields; silently accept without storing.
    if (clean(b.website || b.company_website)) {
      return res.status(201).json({ success: true, data: { reference: null } });
    }

    const full_name = clean(b.full_name || b.fullName || b.name, 150);
    const phone = clean(b.phone || b.phone_number || b.phoneNumber, 30);
    const email = clean(b.email, 150);
    const outlet_slug = clean(b.outlet_slug || b.outlet || b.preferred_outlet, 120);
    const occasion = clean(b.occasion, 120);
    const date_not_decided = b.date_not_decided === true || b.date_not_decided === 'true' || b.date_not_decided === 1;
    const event_date = clean(b.event_date || b.preferred_date, 10);
    const preferred_time = clean(b.preferred_time, 50);
    const duration = clean(b.duration, 80);
    const guest_count = parseInt(b.guest_count ?? b.guests, 10);
    const food_preferences = clean(b.food_preferences, 1000);
    const requirements = clean(b.requirements, 2000);
    const venue_visit_requested = !!(b.venue_visit_requested === true || b.venue_visit_requested === 'true' || b.venue_visit_requested === 1);
    const enquiry_intent = INTENTS.has(clean(b.enquiry_intent)) ? clean(b.enquiry_intent) : 'general';
    const consent = b.consent === true || b.consent === 'true' || b.consent === 1 || b.consent === 'on';

    const errors = {};
    if (!full_name || full_name.length < 2) errors.full_name = 'Enter your name.';
    if (!phone || !/^[+]?[\d\s()-]{8,20}$/.test(phone)) errors.phone = 'Enter a valid phone number with country code.';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (!outlet_slug) errors.outlet = 'Choose an outlet or Help me choose.';
    if (!occasion || !OCCASIONS.has(occasion)) errors.occasion = 'Choose what you are planning.';
    if (!date_not_decided && (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date))) {
      errors.event_date = 'Choose a date or Date not decided.';
    } else if (!date_not_decided && event_date < todayInBengaluru()) {
      errors.event_date = 'Please choose today or a future date.';
    }
    if (!Number.isInteger(guest_count) || guest_count < 1 || guest_count > 500) {
      errors.guest_count = 'Enter an expected guest count.';
    }
    if (!consent) errors.consent = 'Please agree to be contacted about this enquiry.';

    if (Object.keys(errors).length) {
      return res.status(422).json({ success: false, message: 'Please check the highlighted fields.', errors });
    }

    // Resolve outlet record (never trust client-supplied outlet names).
    // JP Nagar is an approved network outlet whose public record may publish
    // after this page — accept its approved slug and label it by name.
    const KNOWN_OUTLETS = {
      koramangala: 'Big Bean Cafe - Koramangala',
      'hsr-layout': 'Big Bean Cafe - HSR Layout',
      indiranagar: 'Big Bean Cafe - Indiranagar',
      jayanagar: 'Big Bean Cafe - Jayanagar',
      kammanahalli: 'Big Bean Cafe - Kammanahalli',
      'rajarajeshwari-nagar': 'Big Bean Cafe - Rajarajeshwari Nagar',
      'electronic-city': 'Electronic City',
      'jp-nagar': 'Big Bean Cafe - JP Nagar',
    };

    let outlet_id = null;
    let outlet_name = null;
    if (outlet_slug !== 'help-me-choose') {
      if (!KNOWN_OUTLETS[outlet_slug]) {
        return res.status(422).json({ success: false, message: 'Please check the highlighted fields.', errors: { outlet: 'Choose an outlet or Help me choose.' } });
      }
      const rows = await executeQuery(
        "SELECT id, name FROM outlets WHERE slug = ? AND status = 'active' LIMIT 1",
        [outlet_slug]
      );
      if (rows.length) {
        outlet_id = rows[0].id;
        outlet_name = rows[0].name;
      } else {
        outlet_name = KNOWN_OUTLETS[outlet_slug];
      }
    } else {
      outlet_name = 'Help me choose';
    }

    const stored_outlet_slug = outlet_slug === 'help-me-choose' ? null : outlet_slug;
    const stored_event_date = date_not_decided ? null : event_date;

    // Soft duplicate protection — identical enquiry within 2 minutes
    const dup = await executeQuery(
      `SELECT id FROM private_event_enquiries
       WHERE phone = ?
         AND outlet_slug <=> ?
         AND occasion = ?
         AND event_date <=> ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
       LIMIT 1`,
      [phone, stored_outlet_slug, occasion, stored_event_date]
    );
    if (dup.length) {
      const existing = await executeQuery('SELECT enquiry_reference FROM private_event_enquiries WHERE id = ?', [dup[0].id]);
      return res.status(409).json({
        success: false,
        message: 'This enquiry was already submitted. Our team will contact you shortly.',
        data: { reference: existing[0]?.enquiry_reference || null },
      });
    }

    const enquiry_reference = await generateReference();

    const result = await executeQuery(
      `INSERT INTO private_event_enquiries
        (enquiry_reference, full_name, phone, email, outlet_id, outlet_slug, outlet_name,
         occasion, event_date, date_not_decided, preferred_time, duration, guest_count,
         food_preferences, requirements, venue_visit_requested, enquiry_intent, consent)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        enquiry_reference, full_name, phone, email, outlet_id, stored_outlet_slug,
        outlet_name, occasion, stored_event_date, date_not_decided ? 1 : 0,
        preferred_time, duration, guest_count, food_preferences, requirements,
        venue_visit_requested ? 1 : 0, enquiry_intent, 1,
      ]
    );

    // Non-blocking admin notification — never fails the enquiry
    createAdminNotification({
      type: 'private_event_enquiry',
      title: 'New Private Event Enquiry',
      message: `${outlet_name || 'No outlet'} · ${occasion} · ${guest_count} guests`,
      module_name: 'private_event_enquiries',
      record_id: result.insertId,
      action_url: `/admin/private-event-enquiries/${result.insertId}`,
      priority: 'normal',
      created_by_type: 'guest',
      created_by_id: null,
      metadata: { reference: enquiry_reference, outlet: outlet_name, occasion, guests: guest_count },
    }).catch(err => console.warn('Private-event notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Your event enquiry has been received.',
      data: { reference: enquiry_reference },
    });
  } catch (error) {
    console.error('Create private event enquiry error:', error);
    res.status(500).json({ success: false, message: 'Unable to submit enquiry. Please try again.' });
  }
};

// ── Admin: list with filters ────────────────────────────────────────
const getAllEnquiries = async (req, res) => {
  try {
    await ensureTable();
    const { status, outlet, occasion, search, date_from, date_to } = req.query;
    const where = [];
    const params = [];

    if (status && status !== 'all') { where.push('pe.status = ?'); params.push(status); }
    if (outlet && outlet !== 'all') { where.push('pe.outlet_slug = ?'); params.push(outlet); }
    if (occasion && occasion !== 'all') { where.push('pe.occasion = ?'); params.push(occasion); }
    if (date_from && /^\d{4}-\d{2}-\d{2}$/.test(date_from)) { where.push('pe.created_at >= ?'); params.push(`${date_from} 00:00:00`); }
    if (date_to && /^\d{4}-\d{2}-\d{2}$/.test(date_to)) { where.push('pe.created_at <= ?'); params.push(`${date_to} 23:59:59`); }
    if (search) {
      where.push('(pe.full_name LIKE ? OR pe.phone LIKE ? OR pe.email LIKE ? OR pe.enquiry_reference LIKE ?)');
      const s = `%${clean(search, 60)}%`;
      params.push(s, s, s, s);
    }

    const scope = await getDataScopeFilter(req.admin || req.user, 'private_event_enquiries', 'pe');
    if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }

    const rows = await executeQuery(
      `SELECT pe.*, au.name AS assigned_name
       FROM private_event_enquiries pe
       LEFT JOIN admin_users au ON au.id = pe.assigned_to
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY pe.created_at DESC
       LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get private event enquiries error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

const getEnquiryById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      `SELECT pe.*, au.name AS assigned_name
       FROM private_event_enquiries pe
       LEFT JOIN admin_users au ON au.id = pe.assigned_to
       WHERE pe.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get private event enquiry error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

const updateEnquiry = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { status, admin_notes, assigned_to } = req.body || {};

    const existing = await executeQuery('SELECT id FROM private_event_enquiries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    if (status !== undefined && !PUBLIC_STATUSES.includes(String(status))) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid: ${PUBLIC_STATUSES.join(', ')}` });
    }
    const assigned = Number.isInteger(Number(assigned_to)) && Number(assigned_to) > 0 ? Number(assigned_to) : null;

    await executeQuery(
      `UPDATE private_event_enquiries
       SET status = COALESCE(?, status), admin_notes = COALESCE(?, admin_notes),
           assigned_to = COALESCE(?, assigned_to), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status ?? null, admin_notes ?? null, assigned, id]
    );
    res.json({ success: true, message: 'Enquiry updated successfully' });
  } catch (error) {
    console.error('Update private event enquiry error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

const updateStatus = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const status = String(req.body.status || '');
    if (!PUBLIC_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid: ${PUBLIC_STATUSES.join(', ')}` });
    }
    const existing = await executeQuery('SELECT id FROM private_event_enquiries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    await executeQuery('UPDATE private_event_enquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Private enquiry status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status. Please try again.' });
  }
};

const deleteEnquiry = async (req, res) => {
  try {
    await ensureTable();
    const existing = await executeQuery('SELECT id FROM private_event_enquiries WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    await executeQuery('DELETE FROM private_event_enquiries WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (error) {
    console.error('Delete private event enquiry error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// ── Admin: send email reply to the customer ───────────────────────
const sendEmail = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM private_event_enquiries WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const r = rows[0];

    const occasionLabel = OCCASION_LABELS[r.occasion] || r.occasion || 'your event';
    const outletLabel = r.outlet_name || 'the selected outlet';
    const subject = clean(req.body?.subject, 200) ||
      `Re: Your Big Bean Cafe Event Enquiry – ${r.enquiry_reference}`;
    const body = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const message = body.slice(0, 10000) ||
      `Hi ${r.full_name},\n\nThank you for your event enquiry with Big Bean Cafe.\n\nWe have received your requirements for ${occasionLabel} at ${outletLabel}. Our team will review the details and get back to you regarding availability, seating and arrangements.\n\nRegards,\nBig Bean Cafe Team`;

    const result = await sendAdminEmailReply({
      moduleName: MODULE,
      recordId: r.id,
      to: r.email,
      name: r.full_name,
      subject,
      message,
      adminId: (req.admin || req.user)?.id || null,
    });

    // A successful server-sent reply marks a fresh enquiry as contacted.
    if (result.success && r.status === 'new') {
      await executeQuery(
        "UPDATE private_event_enquiries SET status = 'contacted', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'new'",
        [r.id]
      );
      result.status = 'contacted';
    }

    res.status(result.success ? 200 : 400).json(result);
  } catch (e) {
    console.error('Private event enquiry sendEmail error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  createEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiry,
  updateStatus,
  deleteEnquiry,
  sendEmail,
};
