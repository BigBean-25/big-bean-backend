const { executeQuery } = require('../config/database');

// Get all blog posts
const getAllBlogPosts = async (req, res) => {
  try {
    const { category, status, search, featured } = req.query;
    
    let query = 'SELECT * FROM blog_posts';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (category && category !== 'all') {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (featured === 'true') {
      whereConditions.push('featured = ?');
      params.push(true);
    }
    
    if (search) {
      whereConditions.push('(title LIKE ? OR excerpt LIKE ? OR content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const blogPosts = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: blogPosts
    });
    
  } catch (error) {
    console.error('Get all blog posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get blog post by ID
const getBlogPostById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blogPost = await executeQuery(
      'SELECT * FROM blog_posts WHERE id = ?',
      [id]
    );
    
    if (blogPost.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    res.json({
      success: true,
      data: blogPost[0]
    });
    
  } catch (error) {
    console.error('Get blog post by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get blog post by slug
const getBlogPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const blogPost = await executeQuery(
      'SELECT * FROM blog_posts WHERE slug = ? AND status = ?',
      [slug, 'published']
    );
    
    if (blogPost.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    res.json({
      success: true,
      data: blogPost[0]
    });
    
  } catch (error) {
    console.error('Get blog post by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new blog post
const createBlogPost = async (req, res) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      author,
      category,
      featured_image,
      tags,
      status,
      featured,
      meta_title,
      meta_description
    } = req.body;
    
    // Validate required fields
    if (!title || !content || !author) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, and author are required'
      });
    }
    
    // Generate slug if not provided
    const blogSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    // Check if slug already exists
    const existingSlug = await executeQuery(
      'SELECT id FROM blog_posts WHERE slug = ?',
      [blogSlug]
    );
    
    if (existingSlug.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A blog post with this slug already exists'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO blog_posts (
        title, slug, excerpt, content, author, category, featured_image,
        tags, status, featured, meta_title, meta_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, blogSlug, excerpt, content, author, category, featured_image,
        JSON.stringify(tags || []), status || 'draft', featured || false,
        meta_title, meta_description
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: {
        id: result.insertId,
        slug: blogSlug,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create blog post error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update blog post
const updateBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if blog post exists
    const existingPost = await executeQuery(
      'SELECT id FROM blog_posts WHERE id = ?',
      [id]
    );
    
    if (existingPost.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    const allowedFields = [
      'title', 'slug', 'excerpt', 'content', 'author', 'category', 'featured_image',
      'tags', 'status', 'featured', 'meta_title', 'meta_description'
    ];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'tags') {
          updateFields.push(`${field} = ?`);
          updateValues.push(JSON.stringify(updateData[field]));
        } else {
          updateFields.push(`${field} = ?`);
          updateValues.push(updateData[field]);
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    updateValues.push(id);
    
    await executeQuery(
      `UPDATE blog_posts SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: 'Blog post updated successfully'
    });
    
  } catch (error) {
    console.error('Update blog post error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete blog post
const deleteBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if blog post exists
    const existingPost = await executeQuery(
      'SELECT id FROM blog_posts WHERE id = ?',
      [id]
    );
    
    if (existingPost.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM blog_posts WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete blog post error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get published blog posts for public display
const getPublishedBlogPosts = async (req, res) => {
  try {
    const { category, limit, offset } = req.query;
    
    let query = 'SELECT * FROM blog_posts WHERE status = ?';
    const params = ['published'];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
      
      if (offset) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }
    
    const blogPosts = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: blogPosts
    });
    
  } catch (error) {
    console.error('Get published blog posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get blog categories
const getBlogCategories = async (req, res) => {
  try {
    const categories = await executeQuery(
      'SELECT DISTINCT category FROM blog_posts WHERE status = ? ORDER BY category',
      ['published']
    );
    
    res.json({
      success: true,
      data: categories.map(cat => cat.category)
    });
    
  } catch (error) {
    console.error('Get blog categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle blog post status
const toggleBlogPostStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (draft/published/archived) is required'
      });
    }
    
    // Check if blog post exists
    const existingPost = await executeQuery(
      'SELECT id FROM blog_posts WHERE id = ?',
      [id]
    );
    
    if (existingPost.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    await executeQuery(
      'UPDATE blog_posts SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      success: true,
      message: 'Blog post status updated successfully'
    });
    
  } catch (error) {
    console.error('Toggle blog post status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllBlogPosts,
  getBlogPostById,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getPublishedBlogPosts,
  getBlogCategories,
  toggleBlogPostStatus
};
