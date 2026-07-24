
const { executeQuery } = require('../config/database');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'seo');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// GET /api/seo-pages — all rows
const getAll = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM seo_pages ORDER BY page_name ASC');
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/seo-pages/page/:pageKey — public fetch by key
const getByKey = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM seo_pages WHERE page_key = ? AND status = "active"',
      [req.params.pageKey]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/seo-pages/by-path?path=/about — public fetch by path
const getByPath = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM seo_pages WHERE page_path = ? AND status = "active"',
      [req.query.path || '/']
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/seo-pages/:id
const getById = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM seo_pages WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/seo-pages
const create = async (req, res) => {
  try {
    const b = req.body;
    const ogImg     = req.files?.og_image?.[0]     ? `uploads/seo/${req.files.og_image[0].filename}`     : (b.og_image     || null);
    const twitterImg= req.files?.twitter_image?.[0] ? `uploads/seo/${req.files.twitter_image[0].filename}` : (b.twitter_image || null);
    const result = await executeQuery(
      `INSERT INTO seo_pages
        (page_key,page_name,page_path,meta_title,meta_description,meta_keywords,canonical_url,
         og_title,og_description,og_image,twitter_title,twitter_description,twitter_image,
         robots_index,robots_follow,schema_json,faq_schema_json,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.page_key,b.page_name,b.page_path,b.meta_title||null,b.meta_description||null,
       b.meta_keywords||null,b.canonical_url||null,b.og_title||null,b.og_description||null,
       ogImg,b.twitter_title||null,b.twitter_description||null,twitterImg,
       b.robots_index!=null?Number(b.robots_index):1,
       b.robots_follow!=null?Number(b.robots_follow):1,
       b.schema_json||null,b.faq_schema_json||null,b.status||'active']
    );
    res.status(201).json({ success: true, message: 'Created', id: result.insertId });
  } catch (e) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Page key already exists' });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/seo-pages/:id
const update = async (req, res) => {
  try {
    const b = req.body;
    const existing = await executeQuery('SELECT * FROM seo_pages WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    const cur = existing[0];
    const ogImg     = req.files?.og_image?.[0]     ? `uploads/seo/${req.files.og_image[0].filename}`     : (b.og_image     !== undefined ? b.og_image     : cur.og_image);
    const twitterImg= req.files?.twitter_image?.[0] ? `uploads/seo/${req.files.twitter_image[0].filename}` : (b.twitter_image !== undefined ? b.twitter_image : cur.twitter_image);
    await executeQuery(
      `UPDATE seo_pages SET
        page_key=?,page_name=?,page_path=?,meta_title=?,meta_description=?,meta_keywords=?,
        canonical_url=?,og_title=?,og_description=?,og_image=?,twitter_title=?,
        twitter_description=?,twitter_image=?,robots_index=?,robots_follow=?,schema_json=?,
        faq_schema_json=?,status=?,updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [b.page_key||cur.page_key,b.page_name||cur.page_name,b.page_path||cur.page_path,
       b.meta_title!==undefined?b.meta_title:cur.meta_title,
       b.meta_description!==undefined?b.meta_description:cur.meta_description,
       b.meta_keywords!==undefined?b.meta_keywords:cur.meta_keywords,
       b.canonical_url!==undefined?b.canonical_url:cur.canonical_url,
       b.og_title!==undefined?b.og_title:cur.og_title,
       b.og_description!==undefined?b.og_description:cur.og_description,
       ogImg,
       b.twitter_title!==undefined?b.twitter_title:cur.twitter_title,
       b.twitter_description!==undefined?b.twitter_description:cur.twitter_description,
       twitterImg,
       b.robots_index!=null?Number(b.robots_index):cur.robots_index,
       b.robots_follow!=null?Number(b.robots_follow):cur.robots_follow,
       b.schema_json!==undefined?b.schema_json:cur.schema_json,
       b.faq_schema_json!==undefined?b.faq_schema_json:cur.faq_schema_json,
       b.status||cur.status,
       req.params.id]
    );
    res.json({ success: true, message: 'Updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/seo-pages/:id
const remove = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT id FROM seo_pages WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    await executeQuery('DELETE FROM seo_pages WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, getByKey, getByPath, getById, create, update, remove };
