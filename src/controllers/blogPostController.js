const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      excerpt TEXT NULL,
      content LONGTEXT NULL,
      author VARCHAR(150) DEFAULT 'Big Bean Café Team',
      category VARCHAR(100) DEFAULT 'coffee-culture',
      featured_image VARCHAR(500) NULL,
      read_time VARCHAR(50) DEFAULT '5 min read',
      is_featured TINYINT(1) DEFAULT 0,
      status ENUM('draft','published','inactive') DEFAULT 'draft',
      published_at DATE NULL,
      meta_title VARCHAR(255) NULL,
      meta_description TEXT NULL,
      tags VARCHAR(500) NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const existing = await executeQuery('SELECT id FROM blog_posts LIMIT 1');
  if (existing.length === 0) {
    const seeds = [
      {
        title: 'The Art of Coffee at Big Bean Café',
        slug: 'the-art-of-coffee-at-big-bean-cafe',
        excerpt: 'Discover the passion, craft, and precision that goes into every cup we serve at Big Bean Café — from farm to your hands.',
        content: `At Big Bean Café, coffee is more than a beverage — it is an art form.\n\nFrom the moment we source our beans from ethical farms to the final pour into your cup, every step is guided by a deep commitment to quality, craft, and community.\n\nOur baristas train for months before they make your drink, learning to balance pressure, temperature, and timing to extract the very best from every single bean.\n\nWhether you prefer a perfectly pulled espresso or a creamy latte art masterpiece, every visit to Big Bean Café is a celebration of the coffee craft.`,
        author: 'Big Bean Café Team', category: 'coffee-culture', read_time: '4 min read',
        is_featured: 1, status: 'published', published_at: new Date().toISOString().split('T')[0],
        sort_order: 1
      },
      {
        title: 'How to Choose Your Perfect Café Drink',
        slug: 'how-to-choose-your-perfect-cafe-drink',
        excerpt: 'Not sure what to order? Our complete guide helps you navigate our menu and find your perfect coffee companion.',
        content: `Choosing the right café drink can feel overwhelming, especially with so many delicious options on our menu.\n\nIf you love bold, intense flavours — start with our signature espresso or Americano.\n\nFor those who prefer something smoother and creamier, a flat white or cappuccino hits the perfect balance.\n\nAnd if you're looking for something refreshing, our cold brew and iced lattes are crowd favourites during the warmer months.\n\nNot a coffee person? Our teas, smoothies, and specialty drinks are crafted with the same love and attention to quality.`,
        author: 'Big Bean Café Team', category: 'brewing-tips', read_time: '5 min read',
        is_featured: 1, status: 'published', published_at: new Date().toISOString().split('T')[0],
        sort_order: 2
      },
      {
        title: 'Why Café Spaces Matter for Work and Conversations',
        slug: 'why-cafe-spaces-matter-for-work-and-conversations',
        excerpt: 'The right café environment can transform your productivity and social connections. Here is why Big Bean Café designs its spaces with you in mind.',
        content: `There is something special about working or meeting in a well-designed café space.\n\nAt Big Bean Café, we believe the environment around you shapes your mood, creativity, and the quality of conversations you have.\n\nThat is why every outlet is thoughtfully designed — with comfortable seating, warm lighting, and the gentle hum of café life that creates the perfect backdrop for both focused work and meaningful connections.\n\nWhether you are closing a deal, catching up with a friend, or simply finding your focus — Big Bean Café is designed to be your third place.`,
        author: 'Big Bean Café Team', category: 'lifestyle', read_time: '6 min read',
        is_featured: 0, status: 'published', published_at: new Date().toISOString().split('T')[0],
        sort_order: 3
      }
    ];

    for (const s of seeds) {
      await executeQuery(`
        INSERT INTO blog_posts
          (title, slug, excerpt, content, author, category, read_time, is_featured, status, published_at, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `, [s.title, s.slug, s.excerpt, s.content, s.author, s.category, s.read_time, s.is_featured, s.status, s.published_at, s.sort_order]);
    }
  }
};

// Generate unique slug from title
const generateSlug = async (title, excludeId = null) => {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let slug = base;
  let counter = 2;
  while (true) {
    const query = excludeId
      ? 'SELECT id FROM blog_posts WHERE slug=? AND id!=?'
      : 'SELECT id FROM blog_posts WHERE slug=?';
    const params = excludeId ? [slug, excludeId] : [slug];
    const existing = await executeQuery(query, params);
    if (existing.length === 0) return slug;
    slug = `${base}-${counter++}`;
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const { search, category, status } = req.query;
    let query = 'SELECT * FROM blog_posts WHERE 1=1';
    const params = [];
    if (search) {
      query += ' AND (title LIKE ? OR excerpt LIKE ? OR author LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category && category !== 'all') { query += ' AND category=?'; params.push(category); }
    if (status && status !== 'all') { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY is_featured DESC, published_at DESC, sort_order ASC, id DESC';
    const rows = await executeQuery(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get all blog posts error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getPublished = async (req, res) => {
  try {
    await ensureTable();
    const { category } = req.query;
    let query = "SELECT * FROM blog_posts WHERE status='published'";
    const params = [];
    if (category && category !== 'all') { query += ' AND category=?'; params.push(category); }
    query += ' ORDER BY is_featured DESC, published_at DESC, sort_order ASC, id DESC';
    const rows = await executeQuery(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get published blog posts error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getFeatured = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM blog_posts WHERE status='published' AND is_featured=1 ORDER BY published_at DESC, id DESC LIMIT 6"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get featured blog posts error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getBySlug = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM blog_posts WHERE slug=? AND status='published'", [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get blog post by slug error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM blog_posts WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get blog post by id error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const create = async (req, res) => {
  try {
    await ensureTable();
    const {
      title, slug, excerpt, content, author, category,
      read_time, is_featured, status, published_at,
      meta_title, meta_description, tags, sort_order
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const finalSlug = slug ? await generateSlug(slug) : await generateSlug(title);
    const imagePath = req.file ? `uploads/blog/${req.file.filename}` : null;
    const pubDate = status === 'published' && !published_at ? new Date().toISOString().split('T')[0] : (published_at || null);

    const result = await executeQuery(`
      INSERT INTO blog_posts
        (title, slug, excerpt, content, author, category, featured_image,
         read_time, is_featured, status, published_at, meta_title, meta_description, tags, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      title, finalSlug, excerpt || null, content || null,
      author || 'Big Bean Café Team', category || 'coffee-culture', imagePath,
      read_time || '5 min read', is_featured ? 1 : 0,
      status || 'draft', pubDate, meta_title || null, meta_description || null,
      tags || null, sort_order || 0
    ]);

    res.status(201).json({ success: true, message: 'Post created successfully', data: { id: result.insertId, slug: finalSlug } });
  } catch (error) {
    console.error('Create blog post error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM blog_posts WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Post not found' });

    const {
      title, slug, excerpt, content, author, category,
      read_time, is_featured, status, published_at,
      meta_title, meta_description, tags, sort_order
    } = req.body;

    let imagePath = existing[0].featured_image;
    if (req.file) {
      if (existing[0].featured_image) {
        const oldPath = path.join(__dirname, '../', existing[0].featured_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imagePath = `uploads/blog/${req.file.filename}`;
    }

    const finalSlug = slug ? await generateSlug(slug, id) : existing[0].slug;
    const pubDate = status === 'published' && !existing[0].published_at && !published_at
      ? new Date().toISOString().split('T')[0]
      : (published_at || existing[0].published_at);

    await executeQuery(`
      UPDATE blog_posts SET
        title=?, slug=?, excerpt=?, content=?, author=?, category=?, featured_image=?,
        read_time=?, is_featured=?, status=?, published_at=?,
        meta_title=?, meta_description=?, tags=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [
      title || existing[0].title, finalSlug, excerpt || null, content || null,
      author || existing[0].author, category || existing[0].category, imagePath,
      read_time || existing[0].read_time, is_featured ? 1 : 0,
      status || existing[0].status, pubDate,
      meta_title || null, meta_description || null, tags || null,
      sort_order || 0, id
    ]);

    res.json({ success: true, message: 'Post updated successfully' });
  } catch (error) {
    console.error('Update blog post error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const deletePost = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM blog_posts WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Post not found' });

    if (existing[0].featured_image) {
      const imgPath = path.join(__dirname, '../', existing[0].featured_image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await executeQuery('DELETE FROM blog_posts WHERE id=?', [id]);
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete blog post error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { getAll, getPublished, getFeatured, getBySlug, getById, create, update, deletePost };
