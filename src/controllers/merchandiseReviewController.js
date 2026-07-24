const { executeQuery } = require('../config/database');
const { createAdminNotification } = require('../services/adminNotificationService');

// Get approved reviews for a product with summary
const getProductReviews = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const productId = parseInt(merchandiseId);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Get approved reviews
    const reviewsQuery = `
      SELECT 
        id, customer_name, rating, review_title, review_message, 
        is_verified_purchase, created_at
      FROM merchandise_reviews 
      WHERE merchandise_id = ? AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const reviews = await executeQuery(reviewsQuery, [productId]);

    // Get rating summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM merchandise_reviews 
      WHERE merchandise_id = ? AND status = 'approved'
    `;
    const [summary] = await executeQuery(summaryQuery, [productId]);

    const avgRating = summary.average_rating ? parseFloat(summary.average_rating).toFixed(1) : '0.0';
    const total = summary.total_reviews || 0;

    const breakdown = {
      5: summary.five_star || 0,
      4: summary.four_star || 0,
      3: summary.three_star || 0,
      2: summary.two_star || 0,
      1: summary.one_star || 0
    };

    // Calculate percentages
    const breakdownWithPercents = {};
    for (const [star, count] of Object.entries(breakdown)) {
      breakdownWithPercents[star] = {
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      };
    }

    res.json({
      success: true,
      average_rating: parseFloat(avgRating),
      total_reviews: total,
      breakdown: breakdownWithPercents,
      reviews
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};

// Submit a review for a product
const submitProductReview = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const productId = parseInt(merchandiseId);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const { customer_name, customer_email, rating, review_title, review_message } = req.body;

    // Validation
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    if (!customer_email || !customer_email.trim()) {
      return res.status(400).json({ success: false, message: 'Customer email is required' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Valid rating (1-5) is required' });
    }
    if (!review_message || !review_message.trim()) {
      return res.status(400).json({ success: false, message: 'Review message is required' });
    }

    // Get product name for notification
    const [product] = await executeQuery(
      'SELECT name FROM merchandise WHERE id = ?',
      [productId]
    );

    const productName = product?.name || 'Product';

    // Insert review with pending status
    const insertQuery = `
      INSERT INTO merchandise_reviews (
        merchandise_id, customer_id, customer_name, customer_email, 
        rating, review_title, review_message, status, is_verified_purchase
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)
    `;
    const result = await executeQuery(insertQuery, [
      productId,
      req.user?.id || null,
      customer_name.trim(),
      customer_email.trim(),
      rating,
      review_title?.trim() || null,
      review_message.trim()
    ]);

    // Create admin notification
    createAdminNotification({
      type: 'merchandise_review',
      title: 'New Product Review',
      message: `${customer_name.trim()} submitted a review for ${productName}`,
      module_name: 'merchandise_reviews',
      record_id: result.insertId,
      action_url: `/admin/merchandise-reviews`,
      priority: 'normal',
      created_by_type: 'customer',
      created_by_id: req.user?.id || null,
      metadata: {
        merchandise_id: productId,
        product_name: productName,
        customer_name: customer_name.trim(),
        rating
      }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    res.json({
      success: true,
      message: 'Thank you! Your review has been submitted for approval.'
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
};

// Admin: Get all reviews with pagination and filters
const getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      whereClause += ' AND mr.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (mr.customer_name LIKE ? OR mr.review_title LIKE ? OR m.name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const query = `
      SELECT 
        mr.id, mr.merchandise_id, mr.customer_name, mr.customer_email,
        mr.rating, mr.review_title, mr.review_message, mr.status,
        mr.is_verified_purchase, mr.created_at,
        m.name as product_name
      FROM merchandise_reviews mr
      LEFT JOIN merchandise m ON mr.merchandise_id = m.id
      ${whereClause}
      ORDER BY mr.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;

    const reviews = await executeQuery(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM merchandise_reviews mr
      LEFT JOIN merchandise m ON mr.merchandise_id = m.id
      ${whereClause}
    `;
    const [countResult] = await executeQuery(countQuery, params);
    const total = countResult.total;

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};

// Admin: Update review status
const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await executeQuery(
      'UPDATE merchandise_reviews SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: `Review ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ success: false, message: 'Failed to update review status' });
  }
};

// Admin: Delete review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    await executeQuery('DELETE FROM merchandise_reviews WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ success: false, message: 'Failed to delete review' });
  }
};

module.exports = {
  getProductReviews,
  submitProductReview,
  getAllReviews,
  updateReviewStatus,
  deleteReview
};
