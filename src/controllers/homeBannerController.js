const { executeQuery } = require('../config/database');

// Get all home banners
const getAllBanners = async (req, res) => {
  try {
    console.log('Get all banners API called');
    const banners = await executeQuery(
      'SELECT * FROM home_hero_banners ORDER BY sort_order ASC, created_at DESC'
    );

    console.log('Banners retrieved successfully:', banners.length);
    res.json({
      success: true,
      data: banners || [],
      message: banners.length === 0 ? 'No banners found' : undefined
    });

  } catch (error) {
    console.error('Home Banner API error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get active banners only
const getActiveBanners = async (req, res) => {
  try {
    console.log('Get active banners API called');
    const banners = await executeQuery(
      'SELECT * FROM home_hero_banners WHERE status = ? ORDER BY sort_order ASC, created_at DESC',
      ['active']
    );

    console.log('Active banners retrieved successfully:', banners.length);
    res.json({
      success: true,
      data: banners || [],
      message: banners.length === 0 ? 'No active banners found' : undefined
    });

  } catch (error) {
    console.error('Home Banner API error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get banner by ID
const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    const banners = await executeQuery(
      'SELECT * FROM home_hero_banners WHERE id = ?',
      [id]
    );

    if (banners.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.json({
      success: true,
      data: banners[0]
    });

  } catch (error) {
    console.error('Get banner by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new banner
const createBanner = async (req, res) => {
  try {
    console.log('Create banner API called');
    console.log('Request body:', req.body);
    console.log('Uploaded files:', req.files);

    const {
      title,
      subtitle,
      description,
      media_type,
      button_1_text,
      button_1_url,
      button_2_text,
      button_2_url,
      text_position,
      overlay_enabled,
      overlay_opacity,
      status,
      sort_order
    } = req.body;

    // Get uploaded file paths
    const desktop_media = req.files?.desktop_media?.[0] ? `/uploads/${req.files.desktop_media[0].mimetype.startsWith('image/') ? 'images' : 'videos'}/${req.files.desktop_media[0].filename}` : null;
    const mobile_media = req.files?.mobile_media?.[0] ? `/uploads/${req.files.mobile_media[0].mimetype.startsWith('image/') ? 'images' : 'videos'}/${req.files.mobile_media[0].filename}` : null;
    const fallback_image = req.files?.fallback_image?.[0] ? `/uploads/images/${req.files.fallback_image[0].filename}` : null;

    console.log('Generated file paths:', { desktop_media, mobile_media, fallback_image });

    // Validate required fields
    if (!title || !media_type || !desktop_media) {
      console.log('Validation failed:', { title, media_type, desktop_media });
      return res.status(400).json({
        success: false,
        message: 'Title, media type, and desktop media are required'
      });
    }

    console.log('Executing database query...');
    const result = await executeQuery(
      `INSERT INTO home_hero_banners 
       (title, subtitle, description, media_type, desktop_media, mobile_media, fallback_image,
        button_1_text, button_1_url, button_2_text, button_2_url, text_position,
        overlay_enabled, overlay_opacity, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title,
        subtitle || null,
        description || null,
        media_type,
        desktop_media,
        mobile_media || null,
        fallback_image || null,
        button_1_text || null,
        button_1_url || null,
        button_2_text || null,
        button_2_url || null,
        text_position || 'center',
        overlay_enabled !== undefined ? (overlay_enabled === 'true' || overlay_enabled === true ? 1 : 0) : 1,
        overlay_opacity || 0.5,
        status || 'active',
        sort_order || 0
      ]
    );
    console.log('Database query executed successfully, result:', result);

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });

  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update banner
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      description,
      media_type,
      button_1_text,
      button_1_url,
      button_2_text,
      button_2_url,
      text_position,
      overlay_enabled,
      overlay_opacity,
      status,
      sort_order
    } = req.body;

    // Check if banner exists
    const existingBanners = await executeQuery(
      'SELECT id FROM home_hero_banners WHERE id = ?',
      [id]
    );

    if (existingBanners.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Get uploaded file paths
    const desktop_media = req.files?.desktop_media?.[0] ? `/uploads/${req.files.desktop_media[0].mimetype.startsWith('image/') ? 'images' : 'videos'}/${req.files.desktop_media[0].filename}` : req.body.desktop_media;
    const mobile_media = req.files?.mobile_media?.[0] ? `/uploads/${req.files.mobile_media[0].mimetype.startsWith('image/') ? 'images' : 'videos'}/${req.files.mobile_media[0].filename}` : req.body.mobile_media;
    const fallback_image = req.files?.fallback_image?.[0] ? `/uploads/images/${req.files.fallback_image[0].filename}` : req.body.fallback_image;

    // Update banner
    await executeQuery(
      `UPDATE home_hero_banners 
       SET title = ?, subtitle = ?, description = ?, media_type = ?, desktop_media = ?, 
           mobile_media = ?, fallback_image = ?, button_1_text = ?, button_1_url = ?, 
           button_2_text = ?, button_2_url = ?, text_position = ?, overlay_enabled = ?, 
           overlay_opacity = ?, status = ?, sort_order = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        title,
        subtitle || null,
        description || null,
        media_type,
        desktop_media,
        mobile_media || null,
        fallback_image || null,
        button_1_text || null,
        button_1_url || null,
        button_2_text || null,
        button_2_url || null,
        text_position || 'center',
        overlay_enabled !== undefined ? (overlay_enabled === 'true' || overlay_enabled === true ? 1 : 0) : 1,
        overlay_opacity || 0.5,
        status || 'active',
        sort_order || 0,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Banner updated successfully'
    });

  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete banner
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if banner exists
    const existingBanners = await executeQuery(
      'SELECT id FROM home_hero_banners WHERE id = ?',
      [id]
    );

    if (existingBanners.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete banner
    await executeQuery(
      'DELETE FROM home_hero_banners WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });

  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update banner status (active/inactive)
const updateBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (active/inactive) is required'
      });
    }

    // Check if banner exists
    const existingBanners = await executeQuery(
      'SELECT id FROM home_hero_banners WHERE id = ?',
      [id]
    );

    if (existingBanners.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Update status
    await executeQuery(
      'UPDATE home_hero_banners SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: `Banner ${status} successfully`
    });

  } catch (error) {
    console.error('Update banner status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllBanners,
  getActiveBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  updateBannerStatus
};
