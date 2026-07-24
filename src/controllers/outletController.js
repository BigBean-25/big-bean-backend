const { executeQuery } = require('../config/database');

/*
 * Actual outlets table columns:
 * id, name, address, phone, email, opening_hours,
 * latitude, longitude, image, status, sort_order,
 * created_at, updated_at
 *
 * NOTE: slug column added via migration. No description, city, state,
 *       postal_code, country, facilities, map_url, image_url columns.
 *       The image column is named "image" (not "image_url").
 */

// Get all outlets
const getAllOutlets = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `SELECT id, name, slug, address, phone, email,
      opening_hours, latitude, longitude, image, status,
      sort_order, created_at, updated_at FROM outlets`;
    const params = [];
    const where = [];

    if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }

    if (search) {
      where.push('(name LIKE ? OR address LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (where.length > 0) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY sort_order ASC, name ASC';

    const outlets = await executeQuery(query, params);

    res.json({ success: true, data: outlets });

  } catch (error) {
    console.error('Get all outlets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch outlets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get outlet by ID
const getOutletById = async (req, res) => {
  try {
    const { id } = req.params;

    const outlet = await executeQuery(
      `SELECT id, name, address, phone, email, opening_hours,
       latitude, longitude, image, status, sort_order,
       created_at, updated_at FROM outlets WHERE id = ?`,
      [id]
    );

    if (outlet.length === 0) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    res.json({ success: true, data: outlet[0] });

  } catch (error) {
    console.error('Get outlet by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch outlet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get outlet by slug
const getOutletBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const outlet = await executeQuery(
      `SELECT id, name, slug, address, phone, email, opening_hours,
       latitude, longitude, image, status, sort_order,
       created_at, updated_at
       FROM outlets WHERE slug = ? AND status = ?`,
      [slug, 'active']
    );

    if (outlet.length === 0) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    res.json({ success: true, data: outlet[0] });

  } catch (error) {
    console.error('Get outlet by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch outlet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new outlet
const createOutlet = async (req, res) => {
  try {
    console.log('CREATE OUTLET BODY:', req.body);
    console.log('CREATE OUTLET FILE:', req.file);

    const {
      name,
      address,
      phone,
      email,
      opening_hours,
      latitude,
      longitude,
      status,
      sort_order,
      slug
    } = req.body || {};

    const cleanName    = (name    || '').trim();
    const cleanAddress = (address || '').trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Outlet name is required',
        received_keys: Object.keys(req.body || {})
      });
    }
    if (!cleanAddress) {
      return res.status(400).json({
        success: false,
        message: 'Outlet address is required',
        received_keys: Object.keys(req.body || {})
      });
    }

    const cleanPhone        = phone         && phone.trim()         !== '' ? phone.trim()         : null;
    const cleanEmail        = email         && email.trim()         !== '' ? email.trim()         : null;
    const cleanOpeningHours = opening_hours && opening_hours.trim() !== '' ? opening_hours.trim() : null;

    const cleanLatitude =
      latitude  === undefined || latitude  === null || latitude  === '' ? null : Number(latitude);
    const cleanLongitude =
      longitude === undefined || longitude === null || longitude === '' ? null : Number(longitude);

    const cleanSortOrder =
      sort_order === undefined || sort_order === null || sort_order === '' ? 0 : parseInt(sort_order, 10);

    let cleanStatus = 'active';
    if (
      status === 'inactive' || status === 'Inactive' ||
      status === '0'        || status === 0           ||
      status === false      || status === 'false'
    ) {
      cleanStatus = 'inactive';
    }

    const image = req.file ? `uploads/outlets/${req.file.filename}` : null;

    const cleanSlug = slug && slug.trim() !== ''
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : cleanName.toLowerCase().replace(/^big bean cafe[^a-z]*/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null;

    const result = await executeQuery(
      `INSERT INTO outlets
        (name, slug, address, phone, email, opening_hours, latitude, longitude, image, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanName, cleanSlug, cleanAddress, cleanPhone, cleanEmail, cleanOpeningHours,
       cleanLatitude, cleanLongitude, image, cleanStatus, cleanSortOrder]
    );

    return res.status(201).json({
      success: true,
      message: 'Outlet created successfully',
      data: { id: result.insertId }
    });

  } catch (error) {
    console.error('Create outlet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create outlet',
      error: error.message
    });
  }
};

// Update outlet
const updateOutlet = async (req, res) => {
  try {
    const { id } = req.params;

    const existingOutlet = await executeQuery(
      'SELECT id, image FROM outlets WHERE id = ?',
      [id]
    );

    if (existingOutlet.length === 0) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    const body = req.body;

    // Build sanitised update payload
    const updateData = {};

    if (body.name       !== undefined) updateData.name          = (body.name || '').trim();
    if (body.address    !== undefined) updateData.address       = (body.address || '').trim();
    if (body.phone      !== undefined) updateData.phone         = (body.phone || '').trim() || null;
    if (body.email      !== undefined) updateData.email         = (body.email || '').trim() || null;
    if (body.opening_hours !== undefined) updateData.opening_hours = (body.opening_hours || '').trim() || null;
    if (body.latitude   !== undefined) updateData.latitude      = (body.latitude  === '' || body.latitude  == null) ? null : body.latitude;
    if (body.longitude  !== undefined) updateData.longitude     = (body.longitude === '' || body.longitude == null) ? null : body.longitude;
    if (body.sort_order !== undefined) updateData.sort_order    = parseInt(body.sort_order, 10) || 0;
    if (body.status     !== undefined) {
      const rawStatus = (body.status || '').toString().toLowerCase();
      updateData.status = ['inactive', 'false', '0'].includes(rawStatus) ? 'inactive' : 'active';
    }

    // If new image uploaded, set it; otherwise keep existing
    if (req.file) {
      updateData.image = `uploads/outlets/${req.file.filename}`;
    }

    if (body.slug !== undefined) updateData.slug = (body.slug || '').trim().toLowerCase() || null;

    const allowedFields = [
      'name', 'slug', 'address', 'phone', 'email',
      'opening_hours', 'latitude', 'longitude', 'status', 'sort_order', 'image'
    ];

    const updateFields = [];
    const updateValues = [];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    updateValues.push(id);

    await executeQuery(
      `UPDATE outlets SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true, message: 'Outlet updated successfully' });

  } catch (error) {
    console.error('Update outlet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update outlet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete outlet
const deleteOutlet = async (req, res) => {
  try {
    const { id } = req.params;

    const existingOutlet = await executeQuery(
      'SELECT id FROM outlets WHERE id = ?',
      [id]
    );

    if (existingOutlet.length === 0) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    await executeQuery('DELETE FROM outlets WHERE id = ?', [id]);

    res.json({ success: true, message: 'Outlet deleted successfully' });

  } catch (error) {
    console.error('Delete outlet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete outlet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Toggle outlet status
const toggleOutletStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (active/inactive) is required'
      });
    }

    const existingOutlet = await executeQuery(
      'SELECT id FROM outlets WHERE id = ?',
      [id]
    );

    if (existingOutlet.length === 0) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    await executeQuery('UPDATE outlets SET status = ? WHERE id = ?', [status, id]);

    res.json({ success: true, message: 'Outlet status updated successfully' });

  } catch (error) {
    console.error('Toggle outlet status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update outlet status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get active outlets for public display
const getActiveOutlets = async (req, res) => {
  try {
    const outlets = await executeQuery(
      `SELECT id, name, slug, address, phone, email, opening_hours,
       latitude, longitude, image, status, sort_order,
       created_at, updated_at
       FROM outlets WHERE status = ? ORDER BY sort_order ASC, name ASC`,
      ['active']
    );

    res.json({ success: true, data: outlets });

  } catch (error) {
    console.error('Get active outlets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active outlets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllOutlets,
  getOutletById,
  getOutletBySlug,
  createOutlet,
  updateOutlet,
  deleteOutlet,
  toggleOutletStatus,
  getActiveOutlets
};
