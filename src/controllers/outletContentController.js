const { executeQuery } = require('../config/database');

/*
 * outlet_content — per-outlet marketing content (facilities + event space).
 * Table is self-created on first use (same convention as gallery_items).
 * Keeps the core `outlets` table untouched.
 */

const FACILITY_KEYS = [
  'wifi',
  'charging_points',
  'parking',
  'outdoor_seating',
  'work_friendly',
  'air_conditioning',
  'event_space',
  'family_friendly',
  'pet_friendly',
  'live_music',
  'rooftop',
  'drive_thru',
];

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS outlet_content (
      outlet_id INT PRIMARY KEY,
      facilities TEXT NULL,
      event_space_text TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const parseFacilities = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((k) => typeof k === 'string');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((k) => typeof k === 'string');
  } catch {
    // tolerate legacy comma-separated values
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const toPayload = (row) => ({
  facilities: row ? parseFacilities(row.facilities) : [],
  event_space_text: row?.event_space_text || '',
});

// GET /api/outlets/slug/:slug/content — public
const getPublicBySlug = async (req, res) => {
  try {
    await ensureTable();
    const { slug } = req.params;
    const outlet = await executeQuery(
      "SELECT id FROM outlets WHERE slug = ? AND status = 'active'",
      [slug]
    );
    if (!outlet.length) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }
    const rows = await executeQuery(
      'SELECT * FROM outlet_content WHERE outlet_id = ?',
      [outlet[0].id]
    );
    res.json({ success: true, data: toPayload(rows[0]) });
  } catch (error) {
    console.error('Get outlet content by slug error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch outlet content' });
  }
};

// GET /api/outlets/:id/content — admin (used by Edit Outlet form)
const getByOutletId = async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid outlet id' });
    const rows = await executeQuery(
      'SELECT * FROM outlet_content WHERE outlet_id = ?',
      [id]
    );
    res.json({ success: true, data: toPayload(rows[0]) });
  } catch (error) {
    console.error('Get outlet content error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch outlet content' });
  }
};

// PUT /api/outlets/:id/content — admin
const upsertByOutletId = async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid outlet id' });

    const outlet = await executeQuery('SELECT id FROM outlets WHERE id = ?', [id]);
    if (!outlet.length) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    const raw = req.body?.facilities;
    const incoming = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(',').map((s) => s.trim())
        : [];
    const facilities = incoming.filter((k) => FACILITY_KEYS.includes(k));

    const eventSpaceText =
      typeof req.body?.event_space_text === 'string'
        ? req.body.event_space_text.trim() || null
        : null;

    await executeQuery(
      `INSERT INTO outlet_content (outlet_id, facilities, event_space_text)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE facilities = VALUES(facilities),
         event_space_text = VALUES(event_space_text)`,
      [id, JSON.stringify(facilities), eventSpaceText]
    );

    res.json({ success: true, message: 'Outlet content updated' });
  } catch (error) {
    console.error('Update outlet content error:', error);
    res.status(500).json({ success: false, message: 'Failed to update outlet content' });
  }
};

module.exports = { getPublicBySlug, getByOutletId, upsertByOutletId, FACILITY_KEYS };
