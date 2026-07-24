const { executeQuery } = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// Future Instagram Graph API sync notes:
//
// When Meta Developer App + Instagram Business Account are ready:
//  1. Set INSTAGRAM_SYNC_ENABLED=true in .env
//  2. Set INSTAGRAM_ACCESS_TOKEN=<long-lived token>
//  3. Set INSTAGRAM_IG_USER_ID=<IG business user ID>
//  4. Endpoint will be:
//     GET https://graph.facebook.com/${version}/${igUserId}/media
//       ?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp
//       &limit=25
//       &access_token=${token}
//  5. Save each media item into the instagram_media table (upsert by instagram_id)
//  6. Optionally schedule sync via node-cron (do not install until needed)
// ─────────────────────────────────────────────────────────────────────────────

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS instagram_media (
      id INT AUTO_INCREMENT PRIMARY KEY,
      instagram_id VARCHAR(100) NOT NULL UNIQUE,
      caption TEXT NULL,
      media_type VARCHAR(50) NULL,
      media_url TEXT NULL,
      thumbnail_url TEXT NULL,
      permalink TEXT NULL,
      timestamp DATETIME NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      is_featured TINYINT(1) DEFAULT 0,
      source VARCHAR(50) DEFAULT 'instagram_graph_api',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

// GET /api/instagram-media/active — public, returns active rows (empty is fine)
const getActive = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM instagram_media WHERE status = 'active' ORDER BY is_featured DESC, timestamp DESC, id DESC"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get active instagram media error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong', data: [] });
  }
};

// GET /api/instagram-media — admin, returns all rows
const getAll = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      'SELECT * FROM instagram_media ORDER BY is_featured DESC, timestamp DESC, id DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get all instagram media error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong', data: [] });
  }
};

// POST /api/instagram-media/sync — admin, future sync trigger
const sync = async (req, res) => {
  const syncEnabled = process.env.INSTAGRAM_SYNC_ENABLED === 'true';
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_IG_USER_ID;
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v20.0';

  if (!syncEnabled) {
    return res.json({
      success: false,
      message: 'Instagram Graph API sync is not enabled yet. Add Meta access token and IG user ID to .env and set INSTAGRAM_SYNC_ENABLED=true to enable automatic sync.'
    });
  }

  if (!token || !igUserId) {
    return res.json({
      success: false,
      message: 'Instagram access token or IG user ID is not configured.'
    });
  }

  // ── Future sync logic (enabled only when env is ready) ─────────────────────
  // const url = `https://graph.facebook.com/${version}/${igUserId}/media` +
  //   `?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp` +
  //   `&limit=25&access_token=${token}`;
  //
  // const response = await fetch(url);
  // const data = await response.json();
  // if (data.error) throw new Error(data.error.message);
  //
  // for (const item of (data.data || [])) {
  //   await executeQuery(`
  //     INSERT INTO instagram_media
  //       (instagram_id, caption, media_type, media_url, thumbnail_url, permalink, timestamp)
  //     VALUES (?,?,?,?,?,?,?)
  //     ON DUPLICATE KEY UPDATE
  //       caption=VALUES(caption), media_type=VALUES(media_type),
  //       media_url=VALUES(media_url), thumbnail_url=VALUES(thumbnail_url),
  //       permalink=VALUES(permalink), timestamp=VALUES(timestamp),
  //       updated_at=CURRENT_TIMESTAMP
  //   `, [item.id, item.caption||null, item.media_type||null,
  //       item.media_url||null, item.thumbnail_url||null,
  //       item.permalink||null, item.timestamp||null]);
  // }
  // return res.json({ success: true, message: `Synced ${data.data.length} items.` });
  // ───────────────────────────────────────────────────────────────────────────

  res.json({ success: false, message: 'Sync function is prepared but not yet implemented. Enable env variables first.' });
};

// PUT /api/instagram-media/:id/status — admin toggle active/inactive
const updateStatus = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const existing = await executeQuery('SELECT id FROM instagram_media WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    await executeQuery('UPDATE instagram_media SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Update instagram media status error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

// DELETE /api/instagram-media/:id — admin delete local DB record only
const deleteMedia = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM instagram_media WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    await executeQuery('DELETE FROM instagram_media WHERE id = ?', [id]);
    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('Delete instagram media error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { getActive, getAll, sync, updateStatus, deleteMedia };
