const express = require('express');
const router = express.Router();
const storeMenuController = require('../controllers/storeMenuController');

const STORE_API_BASE = process.env.STORE_API_BASE || 'https://admin.bigbeancafe.store/api/v1';
const STORE_BRANCH_ID = process.env.STORE_BRANCH_ID || '1';
const STORE_PRODUCT_IMAGE_BASE = process.env.STORE_PRODUCT_IMAGE_BASE || 'https://admin.bigbeancafe.store/storage/app/public/product';
const STORE_CATEGORY_IMAGE_BASE = process.env.STORE_CATEGORY_IMAGE_BASE || 'https://admin.bigbeancafe.store/storage/app/public/category';
const STORE_ORDER_URL = process.env.STORE_ORDER_URL || 'https://bigbeancafe.store';

const storeHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'branch-id': STORE_BRANCH_ID,
  'Branch-Id': STORE_BRANCH_ID,
};

function buildImageUrl(base, filename) {
  if (!filename || filename === 'def.png' || filename === '') return null;
  return `${base}/${filename}`;
}

// GET /api/store-menu
router.get('/', storeMenuController.getStoreMenu);

// GET /api/store-menu/categories
router.get('/categories', async (req, res) => {
  try {
    const url = `${STORE_API_BASE}/categories`;
    const response = await fetch(url, { headers: storeHeaders });

    if (!response.ok) {
      console.error(`[store-menu] categories fetch failed: ${response.status}`);
      return res.status(200).json({
        success: false,
        message: 'Live menu is available on our ordering platform.',
        order_url: STORE_ORDER_URL,
        data: [],
      });
    }

    const json = await response.json();
    const rawCategories = Array.isArray(json) ? json : (json.data || json.categories || []);

    const data = rawCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      image: buildImageUrl(STORE_CATEGORY_IMAGE_BASE, cat.image),
      banner_image: buildImageUrl(STORE_CATEGORY_IMAGE_BASE, cat.banner_image),
      children: (cat.childes || cat.children || []).map((child) => ({
        id: child.id,
        name: child.name,
        image: buildImageUrl(STORE_CATEGORY_IMAGE_BASE, child.image),
        banner_image: buildImageUrl(STORE_CATEGORY_IMAGE_BASE, child.banner_image),
        children: [],
      })),
    }));

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
router.get('/products/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 1;

    const url = `${STORE_API_BASE}/categories/products/${categoryId}?offset=${offset}&limit=${limit}&product_type=all`;

    const response = await fetch(url, { headers: storeHeaders });

    if (response.status === 403) {
      return res.status(200).json({
        success: false,
        message: 'Live menu is available on our ordering platform.',
        order_url: STORE_ORDER_URL,
        data: [],
      });
    }

    if (!response.ok) {
      console.error(`[store-menu] products fetch failed: ${response.status}`);
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
