const STORE_API_BASE = process.env.STORE_API_BASE || 'https://admin.bigbeancafe.store/api/v1';
const STORE_BRANCH_ID = process.env.STORE_BRANCH_ID || '1';
const STORE_PRODUCT_IMAGE_BASE = process.env.STORE_PRODUCT_IMAGE_BASE || 'https://admin.bigbeancafe.store/storage/app/public/product';
const STORE_CATEGORY_IMAGE_BASE = process.env.STORE_CATEGORY_IMAGE_BASE || 'https://admin.bigbeancafe.store/storage/app/public/category';

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

function formatProduct(product) {
  const price = product.branch_product?.price ?? product.price ?? 0;
  const is_available = product.branch_product?.is_available === 1 && product.status === 1;
  const imageFile = product.image;
  const image_url = buildImageUrl(STORE_PRODUCT_IMAGE_BASE, imageFile);

  const numPrice = parseFloat(price) || 0;
  const display_price = numPrice > 0
    ? `₹${Number.isInteger(numPrice) ? numPrice : numPrice.toFixed(2)}`
    : 'See menu';

  const productType = String(product.product_type || '').toLowerCase();

  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    price: numPrice,
    display_price,
    image: imageFile,
    image_url,
    product_type: product.product_type || 'veg',
    is_veg: productType === 'veg' || product.is_veg === true || product.is_veg === 1,
    status: product.status,
    is_available,
  };
}

async function fetchProductsForCategory(categoryId) {
  try {
    const url = `${STORE_API_BASE}/categories/products/${categoryId}?offset=1&limit=20&product_type=all`;
    const response = await fetch(url, { headers: storeHeaders });

    if (!response.ok) {
      console.error(`[store-menu] products fetch failed for category ${categoryId}: ${response.status}`);
      return [];
    }

    const json = await response.json();
    const rawProducts = json.products || json.data || [];
    return rawProducts.map(formatProduct);
  } catch (err) {
    console.error(`[store-menu] products error for category ${categoryId}:`, err.message);
    return [];
  }
}

// GET /api/store-menu
exports.getStoreMenu = async (req, res) => {
  try {
    const response = await fetch(`${STORE_API_BASE}/categories`, { headers: storeHeaders });

    if (!response.ok) {
      console.error('[store-menu] categories fetch failed:', response.status);
      return res.status(200).json({
        success: false,
        data: [],
        message: 'Unable to fetch store menu',
      });
    }

    const json = await response.json();
    const rawCategories = Array.isArray(json) ? json : (json.data || json.categories || []);

    if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
      return res.status(200).json({
        success: false,
        data: [],
        message: 'Unable to fetch store menu',
      });
    }

    const categories = [];
    for (const cat of rawCategories.slice(0, 20)) {
      const items = await fetchProductsForCategory(cat.id);
      categories.push({
        id: cat.id,
        name: cat.name,
        description: cat.description || '',
        image: buildImageUrl(STORE_CATEGORY_IMAGE_BASE, cat.image),
        items,
      });
    }

    return res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    console.error('[store-menu] menu error:', err.message);
    return res.status(200).json({
      success: false,
      data: [],
      message: 'Unable to fetch store menu',
    });
  }
};
