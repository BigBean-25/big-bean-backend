const express = require('express');
const router = express.Router();
const storeMenuController = require('../controllers/storeMenuController');
const { executeQuery } = require('../config/database');

const STORE_API_BASE = process.env.STORE_API_BASE || 'https://admin.bigbeancafe.store/api/v1';
const STORE_BRANCH_ID_DEFAULT = process.env.STORE_BRANCH_ID || '1';
const STORE_PRODUCT_IMAGE_BASE = process.env.STORE_PRODUCT_IMAGE_BASE || 'https://admin.bigbeancafe.store/storage/app/public/product';
const STORE_CATEGORY_IMAGE_BASE = process.env.STORE_CATEGORY_IMAGE_BASE || 'https://admin.bigbeancafe.store/storage/app/public/category';
const STORE_ORDER_URL = process.env.STORE_ORDER_URL || 'https://bigbeancafe.store';

// Returns a fresh headers object per request — never mutate a shared object.
function getStoreHeaders(branchId) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'branch-id': String(branchId),
    'Branch-Id': String(branchId),
  };
}

// Resolve website outlet ID → store_branch_id from DB.
// Returns { branchId } on success.
// Returns { error, code, message, status } on failure — caller sends the response.
async function resolveStoreBranchForOutlet(outletId) {
  const id = parseInt(outletId, 10);
  if (!id || id <= 0) {
    return { error: true, code: 'INVALID_OUTLET', message: 'Invalid outlet ID.', status: 400 };
  }

  let rows;
  try {
    rows = await executeQuery(
      'SELECT id, status, store_branch_id FROM outlets WHERE id = ?',
      [id]
    );
  } catch (err) {
    console.error('[store-menu] DB lookup error:', err.message);
    return { error: true, code: 'DB_ERROR', message: 'Could not resolve outlet.', status: 500 };
  }

  if (!rows || rows.length === 0) {
    return { error: true, code: 'OUTLET_NOT_FOUND', message: 'Outlet not found.', status: 404 };
  }

  const outlet = rows[0];

  if (outlet.status !== 'active') {
    return { error: true, code: 'OUTLET_INACTIVE', message: 'This outlet is not currently active.', status: 200 };
  }

  const branchId = outlet.store_branch_id;
  if (!branchId || branchId <= 0) {
    return { error: true, code: 'MENU_NOT_CONFIGURED', message: 'Menu is not configured for this outlet.', status: 200 };
  }

  return { branchId };
}

function buildImageUrl(base, filename) {
  if (!filename || filename === 'def.png' || filename === '') return null;
  return `${base}/${filename}`;
}

function mapCategory(cat) {
  const rawChildren = cat.childes || cat.children || cat.sub_categories || cat.subcategories || [];
  return {
    id: cat.id,
    name: cat.name,
    image: buildImageUrl(STORE_CATEGORY_IMAGE_BASE, cat.image),
    banner_image: buildImageUrl(STORE_CATEGORY_IMAGE_BASE, cat.banner_image),
    children: rawChildren.map(child => mapCategory(child)),
  };
}

// GET /api/store-menu/outlets — active outlets with menu_available flag for the menu selector
router.get('/outlets', async (req, res) => {
  try {
    const rows = await executeQuery(
      `SELECT id, name, slug, address,
       CASE WHEN store_branch_id IS NOT NULL AND store_branch_id > 0 THEN 1 ELSE 0 END AS menu_available
       FROM outlets WHERE status = 'active' ORDER BY sort_order ASC, name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[store-menu] outlets error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load outlets.' });
  }
});

// GET /api/store-menu
router.get('/', storeMenuController.getStoreMenu);

// GET /api/store-menu/categories
// Optional: ?outlet_id=<websiteOutletId>  — when present, resolves branch from DB.
// When absent: legacy behaviour using STORE_BRANCH_ID env.
router.get('/categories', async (req, res) => {
  try {
    let branchId;

    if (req.query.outlet_id) {
      const result = await resolveStoreBranchForOutlet(req.query.outlet_id);
      if (result.error) {
        return res.status(result.status).json({
          success: false,
          code: result.code,
          message: result.message,
          data: [],
        });
      }
      branchId = result.branchId;
    } else {
      // Legacy: no outlet_id — use env default
      branchId = STORE_BRANCH_ID_DEFAULT;
    }

    const headers = getStoreHeaders(branchId);

    const allRaw = [];
    let page = 1;
    let totalSize = Infinity;
    const pageLimit = 50;

    while (allRaw.length < totalSize) {
      const url = `${STORE_API_BASE}/categories?limit=${pageLimit}&offset=${page}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error(`[store-menu] categories fetch failed: ${response.status} (branch ${branchId})`);
        break;
      }

      const json = await response.json();
      const pageCategories = Array.isArray(json) ? json : (json.categories || json.data || []);

      if (json.total_size != null) {
        totalSize = Number(json.total_size);
      } else {
        totalSize = pageCategories.length;
      }

      if (pageCategories.length === 0) break;

      allRaw.push(...pageCategories);
      page += 1;

      // Safety: prevent infinite loops
      if (page > 20) break;
    }

    if (allRaw.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'Live menu is available on our ordering platform.',
        order_url: STORE_ORDER_URL,
        data: [],
      });
    }

    const data = allRaw.map(cat => mapCategory(cat));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[store-menu] categories error:', err.message);
    return res.status(200).json({
      success: false,
      message: 'Could not load categories. Please try again.',
      order_url: STORE_ORDER_URL,
      data: [],
    });
  }
});

// GET /api/store-menu/products/:categoryId
// Optional: ?outlet_id=<websiteOutletId>  — when present, resolves branch from DB.
// When absent: legacy behaviour using STORE_BRANCH_ID env.
router.get('/products/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 1;

    let branchId;

    if (req.query.outlet_id) {
      const result = await resolveStoreBranchForOutlet(req.query.outlet_id);
      if (result.error) {
        return res.status(result.status).json({
          success: false,
          code: result.code,
          message: result.message,
          data: [],
        });
      }
      branchId = result.branchId;
    } else {
      // Legacy: no outlet_id — use env default
      branchId = STORE_BRANCH_ID_DEFAULT;
    }

    const headers = getStoreHeaders(branchId);
    const url = `${STORE_API_BASE}/categories/products/${categoryId}?offset=${offset}&limit=${limit}&product_type=all`;

    const response = await fetch(url, { headers });

    if (response.status === 403) {
      return res.status(200).json({
        success: false,
        message: 'Live menu is available on our ordering platform.',
        order_url: STORE_ORDER_URL,
        data: [],
      });
    }

    if (!response.ok) {
      console.error(`[store-menu] products fetch failed: ${response.status} (branch ${branchId})`);
      return res.status(200).json({
        success: false,
        message: 'Could not load products. Please try again.',
        order_url: STORE_ORDER_URL,
        data: [],
      });
    }

    const json = await response.json();
    const rawProducts = json.products || json.data || [];
    const total_size = json.total_size || rawProducts.length;

    const data = rawProducts.map((product) => {
      const price = product.branch_product?.price ?? product.price ?? 0;
      const is_available =
        product.branch_product?.is_available === 1 && product.status === 1;
      const imageFile = product.image;
      const image_url = buildImageUrl(STORE_PRODUCT_IMAGE_BASE, imageFile);

      const numPrice = parseFloat(price) || 0;
      const display_price = numPrice > 0
        ? `₹${Number.isInteger(numPrice) ? numPrice : numPrice.toFixed(2)}`
        : 'See menu';

      return {
        id: product.id,
        name: product.name,
        description: product.description || '',
        image: imageFile,
        image_url,
        price: numPrice,
        display_price,
        tax: product.tax || 0,
        status: product.status,
        product_type: product.product_type || 'veg',
        is_available,
        category_ids: product.category_ids || [],
      };
    });

    return res.json({ success: true, total_size, data });
  } catch (err) {
    console.error('[store-menu] products error:', err.message);
    return res.status(200).json({
      success: false,
      message: 'Could not load products. Please try again.',
      order_url: STORE_ORDER_URL,
      data: [],
    });
  }
});

// GET /api/store-menu/products (default — redirects to cold beverages category 77)
router.get('/products', (req, res) => {
  res.redirect('/api/store-menu/products/77');
});

module.exports = router;
