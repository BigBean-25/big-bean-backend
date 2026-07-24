const { executeQuery } = require('../config/database');

// Get all SEO settings
const getAllSeoSettings = async (req, res) => {
  try {
    const { page } = req.query;
    
    let query = 'SELECT * FROM seo_settings';
    const params = [];
    
    if (page) {
      query += ' WHERE page = ?';
      params.push(page);
    }
    
    query += ' ORDER BY page ASC';
    
    const seoSettings = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: seoSettings
    });
    
  } catch (error) {
    console.error('Get all SEO settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get SEO setting by page
const getSeoSettingByPage = async (req, res) => {
  try {
    const { page } = req.params;
    
    const seoSetting = await executeQuery(
      'SELECT * FROM seo_settings WHERE page = ?',
      [page]
    );
    
    if (seoSetting.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SEO setting not found for this page'
      });
    }
    
    res.json({
      success: true,
      data: seoSetting[0]
    });
    
  } catch (error) {
    console.error('Get SEO setting by page error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create or update SEO setting
const upsertSeoSetting = async (req, res) => {
  try {
    const {
      page,
      title,
      description,
      keywords,
      og_title,
      og_description,
      og_image,
      canonical_url,
      robots,
      structured_data
    } = req.body;
    
    // Validate required fields
    if (!page || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Page, title, and description are required'
      });
    }
    
    // Check if SEO setting exists for this page
    const existingSetting = await executeQuery(
      'SELECT id FROM seo_settings WHERE page = ?',
      [page]
    );
    
    if (existingSetting.length > 0) {
      // Update existing setting
      await executeQuery(
        `UPDATE seo_settings SET 
          title = ?, description = ?, keywords = ?, og_title = ?, 
          og_description = ?, og_image = ?, canonical_url = ?, 
          robots = ?, structured_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE page = ?`,
        [
          title, description, keywords, og_title, og_description, og_image,
          canonical_url, robots, JSON.stringify(structured_data || {}), page
        ]
      );
      
      res.json({
        success: true,
        message: 'SEO setting updated successfully'
      });
    } else {
      // Create new setting
      await executeQuery(
        `INSERT INTO seo_settings (
          page, title, description, keywords, og_title, og_description,
          og_image, canonical_url, robots, structured_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          page, title, description, keywords, og_title, og_description,
          og_image, canonical_url, robots, JSON.stringify(structured_data || {})
        ]
      );
      
      res.status(201).json({
        success: true,
        message: 'SEO setting created successfully'
      });
    }
    
  } catch (error) {
    console.error('Upsert SEO setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete SEO setting
const deleteSeoSetting = async (req, res) => {
  try {
    const { page } = req.params;
    
    // Check if setting exists
    const existingSetting = await executeQuery(
      'SELECT id FROM seo_settings WHERE page = ?',
      [page]
    );
    
    if (existingSetting.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SEO setting not found for this page'
      });
    }
    
    await executeQuery(
      'DELETE FROM seo_settings WHERE page = ?',
      [page]
    );
    
    res.json({
      success: true,
      message: 'SEO setting deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete SEO setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get sitemap data
const getSitemapData = async (req, res) => {
  try {
    const sitemapData = {
      pages: [],
      lastModified: new Date().toISOString()
    };
    
    // Get static pages with SEO settings
    const pages = await executeQuery(
      'SELECT page, updated_at FROM seo_settings WHERE status = ?',
      ['active']
    );
    
    // Get dynamic content pages
    const blogPosts = await executeQuery(
      'SELECT slug, updated_at FROM blog_posts WHERE status = ?',
      ['published']
    );
    
    const outlets = await executeQuery(
      'SELECT slug, updated_at FROM outlets WHERE status = ?',
      ['active']
    );
    
    // Add static pages
    pages.forEach(page => {
      sitemapData.pages.push({
        url: `/${page.page}`,
        lastModified: page.updated_at,
        changeFreq: 'weekly',
        priority: 0.8
      });
    });
    
    // Add blog posts
    blogPosts.forEach(post => {
      sitemapData.pages.push({
        url: `/blog/${post.slug}`,
        lastModified: post.updated_at,
        changeFreq: 'monthly',
        priority: 0.6
      });
    });
    
    // Add outlets
    outlets.forEach(outlet => {
      sitemapData.pages.push({
        url: `/outlets/${outlet.slug}`,
        lastModified: outlet.updated_at,
        changeFreq: 'monthly',
        priority: 0.7
      });
    });
    
    res.json({
      success: true,
      data: sitemapData
    });
    
  } catch (error) {
    console.error('Get sitemap data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get robots.txt content
const getRobotsTxt = async (req, res) => {
  try {
    const robotsContent = `User-agent: *
Allow: /
Sitemap: ${process.env.FRONTEND_URL || 'https://bigbeancafe.in'}/sitemap.xml

# Disallow admin areas
Disallow: /admin/
Disallow: /api/

# Allow specific bot agents
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(robotsContent);
    
  } catch (error) {
    console.error('Get robots.txt error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllSeoSettings,
  getSeoSettingByPage,
  upsertSeoSetting,
  deleteSeoSetting,
  getSitemapData,
  getRobotsTxt
};
