const { executeQuery } = require('../config/database');

/*
 * Actual outlets table columns:
 * id, name, slug, address, phone, email, opening_hours,
 * latitude, longitude, image, status, sort_order, store_branch_id,
 * seo_title, seo_description, seo_h1, og_title, og_description,
 * created_at, updated_at
 *
 * NOTE: slug column added via migration. store_branch_id added via
 *       add_store_branch_id_to_outlets.sql migration. SEO fields added
 *       via add_seo_fields_to_outlets.sql migration.
 *       No description, city, state, postal_code, country, facilities,
 *       map_url, image_url columns. Image column is named "image".
 */

// Get all outlets
const getAllOutlets = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `SELECT id, name, slug, address, phone, email,
      opening_hours, latitude, longitude, image, status,
      sort_order, store_branch_id,
      seo_title, seo_description, seo_h1, og_title, og_description,
      created_at, updated_at FROM outlets`;
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
      `SELECT id, name, slug, address, phone, email, opening_hours,
       latitude, longitude, image, status, sort_order,
       store_branch_id, seo_title, seo_description, seo_h1,
       og_title, og_description, created_at, updated_at
       FROM outlets WHERE id = ?`,
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
       seo_title, seo_description, seo_h1, og_title, og_description,
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
      slug,
      store_branch_id,
      seo_title,
      seo_description,
      seo_h1,
      og_title,
      og_description
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

    let cleanStoreBranchId = null;
    if (store_branch_id !== undefined && store_branch_id !== null && store_branch_id !== '') {
      const parsed = parseInt(store_branch_id, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        cleanStoreBranchId = parsed;
      } else {
        return res.status(400).json({
          success: false,
          message: 'store_branch_id must be a positive integer or empty'
        });
      }
    }

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

    const cleanSeoTitle       = seo_title       && seo_title.trim()       !== '' ? seo_title.trim()       : null;
    const cleanSeoDescription = seo_description && seo_description.trim() !== '' ? seo_description.trim() : null;
    const cleanSeoH1          = seo_h1          && seo_h1.trim()          !== '' ? seo_h1.trim()          : null;
    const cleanOgTitle        = og_title        && og_title.trim()        !== '' ? og_title.trim()        : null;
    const cleanOgDescription  = og_description  && og_description.trim()  !== '' ? og_description.trim()  : null;

    const result = await executeQuery(
      `INSERT INTO outlets
        (name, slug, address, phone, email, opening_hours, latitude, longitude, image, status, sort_order, store_branch_id,
         seo_title, seo_description, seo_h1, og_title, og_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanName, cleanSlug, cleanAddress, cleanPhone, cleanEmail, cleanOpeningHours,
       cleanLatitude, cleanLongitude, image, cleanStatus, cleanSortOrder, cleanStoreBranchId,
       cleanSeoTitle, cleanSeoDescription, cleanSeoH1, cleanOgTitle, cleanOgDescription]
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

    if (body.seo_title       !== undefined) updateData.seo_title       = (body.seo_title       || '').trim() || null;
    if (body.seo_description !== undefined) updateData.seo_description = (body.seo_description || '').trim() || null;
    if (body.seo_h1          !== undefined) updateData.seo_h1          = (body.seo_h1          || '').trim() || null;
    if (body.og_title        !== undefined) updateData.og_title        = (body.og_title        || '').trim() || null;
    if (body.og_description  !== undefined) updateData.og_description  = (body.og_description  || '').trim() || null;

    if (body.store_branch_id !== undefined) {
      const raw = body.store_branch_id;
      if (raw === null || raw === '' || raw === 'null') {
        updateData.store_branch_id = null;
      } else {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          updateData.store_branch_id = parsed;
        } else {
          return res.status(400).json({
            success: false,
            message: 'store_branch_id must be a positive integer or empty'
          });
        }
      }
    }

    const allowedFields = [
      'name', 'slug', 'address', 'phone', 'email',
      'opening_hours', 'latitude', 'longitude', 'status', 'sort_order', 'image', 'store_branch_id',
      'seo_title', 'seo_description', 'seo_h1', 'og_title', 'og_description'
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
       CASE WHEN store_branch_id IS NOT NULL AND store_branch_id > 0 THEN 1 ELSE 0 END AS menu_available,
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
