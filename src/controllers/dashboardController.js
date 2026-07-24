const { executeQuery } = require('../config/database');

// Get dashboard overview statistics
const getDashboardOverview = async (req, res) => {
  try {
    const overview = {};
    
    // Get basic counts
    const menuCount = await executeQuery('SELECT COUNT(*) as count FROM menu_items WHERE status = ?', ['active']);
    const outletCount = await executeQuery('SELECT COUNT(*) as count FROM outlets WHERE status = ?', ['active']);
    const offerCount = await executeQuery('SELECT COUNT(*) as count FROM offers WHERE status = ?', ['active']);
    const blogCount = await executeQuery('SELECT COUNT(*) as count FROM blog_posts WHERE status = ?', ['published']);
    
    // Get enquiry counts
    const contactEnquiries = await executeQuery('SELECT COUNT(*) as count FROM contact_enquiries WHERE status = ?', ['pending']);
    const franchiseEnquiries = await executeQuery('SELECT COUNT(*) as count FROM franchise_enquiries WHERE status = ?', ['pending']);
    const careerApplications = await executeQuery('SELECT COUNT(*) as count FROM career_applications WHERE status = ?', ['pending']);
    const corporateOrders = await executeQuery('SELECT COUNT(*) as count FROM corporate_orders WHERE status = ?', ['pending']);
    const reservations = await executeQuery('SELECT COUNT(*) as count FROM reservations WHERE status = ?', ['pending']);
    
    // Get recent activity counts (last 7 days)
    const recentContacts = await executeQuery('SELECT COUNT(*) as count FROM contact_enquiries WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const recentFranchises = await executeQuery('SELECT COUNT(*) as count FROM franchise_enquiries WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const recentCareers = await executeQuery('SELECT COUNT(*) as count FROM career_applications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const recentCorporate = await executeQuery('SELECT COUNT(*) as count FROM corporate_orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const recentReservations = await executeQuery('SELECT COUNT(*) as count FROM reservations WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    
    overview.basic_stats = {
      menu_items: menuCount[0].count,
      outlets: outletCount[0].count,
      offers: offerCount[0].count,
      blog_posts: blogCount[0].count
    };
    
    overview.pending_enquiries = {
      contact: contactEnquiries[0].count,
      franchise: franchiseEnquiries[0].count,
      careers: careerApplications[0].count,
      corporate: corporateOrders[0].count,
      reservations: reservations[0].count
    };
    
    overview.recent_activity = {
      contact: recentContacts[0].count,
      franchise: recentFranchises[0].count,
      careers: recentCareers[0].count,
      corporate: recentCorporate[0].count,
      reservations: recentReservations[0].count
    };
    
    res.json({
      success: true,
      data: overview
    });
    
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get recent activities
const getRecentActivities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const activities = [];
    
    // Get recent contact enquiries
    const recentContacts = await executeQuery(
      'SELECT name, created_at, "contact" as type FROM contact_enquiries ORDER BY created_at DESC LIMIT ?',
      [parseInt(limit)]
    );
    
    // Get recent franchise enquiries
    const recentFranchises = await executeQuery(
      'SELECT name, created_at, "franchise" as type FROM franchise_enquiries ORDER BY created_at DESC LIMIT ?',
      [parseInt(limit)]
    );
    
    // Get recent career applications
    const recentCareers = await executeQuery(
      'SELECT name, created_at, "career" as type FROM career_applications ORDER BY created_at DESC LIMIT ?',
      [parseInt(limit)]
    );
    
    // Get recent corporate orders
    const recentCorporate = await executeQuery(
      'SELECT company_name as name, created_at, "corporate" as type FROM corporate_orders ORDER BY created_at DESC LIMIT ?',
      [parseInt(limit)]
    );
    
    // Get recent reservations
    const recentReservations = await executeQuery(
      'SELECT name, created_at, "reservation" as type FROM reservations ORDER BY created_at DESC LIMIT ?',
      [parseInt(limit)]
    );
    
    // Combine and sort all activities
    activities.push(...recentContacts, ...recentFranchises, ...recentCareers, ...recentCorporate, ...recentReservations);
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Limit to requested number
    const limitedActivities = activities.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: limitedActivities
    });
    
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get analytics data
const getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    
    const analytics = {};
    
    // Get contact enquiries trend
    const contactTrend = await executeQuery(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM contact_enquiries 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
    
    // Get franchise enquiries trend
    const franchiseTrend = await executeQuery(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM franchise_enquiries 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
    
    // Get career applications trend
    const careerTrend = await executeQuery(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM career_applications 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
    
    // Get reservations trend
    const reservationTrend = await executeQuery(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM reservations 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
    
    analytics.trends = {
      contact: contactTrend,
      franchise: franchiseTrend,
      career: careerTrend,
      reservation: reservationTrend
    };
    
    // Get category breakdown
    const contactCategories = await executeQuery(`
      SELECT category, COUNT(*) as count
      FROM contact_enquiries
      GROUP BY category
      ORDER BY count DESC
    `);
    
    const franchiseCities = await executeQuery(`
      SELECT city, COUNT(*) as count
      FROM franchise_enquiries
      GROUP BY city
      ORDER BY count DESC
      LIMIT 10
    `);
    
    const careerPositions = await executeQuery(`
      SELECT position, COUNT(*) as count
      FROM career_applications
      GROUP BY position
      ORDER BY count DESC
      LIMIT 10
    `);
    
    analytics.categories = {
      contact: contactCategories,
      franchise: franchiseCities,
      career: careerPositions
    };
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get system alerts
const getSystemAlerts = async (req, res) => {
  try {
    const alerts = [];
    
    // Check for high pending enquiries
    const pendingContacts = await executeQuery('SELECT COUNT(*) as count FROM contact_enquiries WHERE status = ?', ['pending']);
    if (pendingContacts[0].count > 5) {
      alerts.push({
        type: 'warning',
        title: 'High Contact Enquiries',
        message: `${pendingContacts[0].count} contact enquiries pending review`,
        action: '/admin/contact-enquiries'
      });
    }
    
    // Check for low stock merchandise (if applicable)
    const lowStockItems = await executeQuery('SELECT COUNT(*) as count FROM merchandise WHERE stock_quantity <= 10 AND stock_quantity > 0');
    if (lowStockItems[0].count > 0) {
      alerts.push({
        type: 'warning',
        title: 'Low Stock Items',
        message: `${lowStockItems[0].count} merchandise items running low on stock`,
        action: '/admin/merchandise'
      });
    }
    
    // Check for upcoming events
    const upcomingEvents = await executeQuery('SELECT COUNT(*) as count FROM events WHERE event_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status = ?', ['active']);
    if (upcomingEvents[0].count > 0) {
      alerts.push({
        type: 'info',
        title: 'Upcoming Events',
        message: `${upcomingEvents[0].count} events scheduled for this week`,
        action: '/admin/events'
      });
    }
    
    // Check for expired offers
    const expiredOffers = await executeQuery('SELECT COUNT(*) as count FROM offers WHERE valid_until < CURDATE() AND status = ?', ['active']);
    if (expiredOffers[0].count > 0) {
      alerts.push({
        type: 'warning',
        title: 'Expired Offers',
        message: `${expiredOffers[0].count} offers have expired but are still active`,
        action: '/admin/offers'
      });
    }
    
    res.json({
      success: true,
      data: alerts
    });
    
  } catch (error) {
    console.error('Get system alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get quick stats
const getQuickStats = async (req, res) => {
  try {
    const stats = {};
    
    // Today's stats
    const todayContacts = await executeQuery('SELECT COUNT(*) as count FROM contact_enquiries WHERE DATE(created_at) = CURDATE()');
    const todayFranchises = await executeQuery('SELECT COUNT(*) as count FROM franchise_enquiries WHERE DATE(created_at) = CURDATE()');
    const todayCareers = await executeQuery('SELECT COUNT(*) as count FROM career_applications WHERE DATE(created_at) = CURDATE()');
    const todayCorporate = await executeQuery('SELECT COUNT(*) as count FROM corporate_orders WHERE DATE(created_at) = CURDATE()');
    const todayReservations = await executeQuery('SELECT COUNT(*) as count FROM reservations WHERE DATE(created_at) = CURDATE()');
    
    // This week's stats
    const weekContacts = await executeQuery('SELECT COUNT(*) as count FROM contact_enquiries WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const weekFranchises = await executeQuery('SELECT COUNT(*) as count FROM franchise_enquiries WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const weekCareers = await executeQuery('SELECT COUNT(*) as count FROM career_applications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const weekCorporate = await executeQuery('SELECT COUNT(*) as count FROM corporate_orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const weekReservations = await executeQuery('SELECT COUNT(*) as count FROM reservations WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    
    // This month's stats
    const monthContacts = await executeQuery('SELECT COUNT(*) as count FROM contact_enquiries WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    const monthFranchises = await executeQuery('SELECT COUNT(*) as count FROM franchise_enquiries WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    const monthCareers = await executeQuery('SELECT COUNT(*) as count FROM career_applications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    const monthCorporate = await executeQuery('SELECT COUNT(*) as count FROM corporate_orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    const monthReservations = await executeQuery('SELECT COUNT(*) as count FROM reservations WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    
    stats.today = {
      contact: todayContacts[0].count,
      franchise: todayFranchises[0].count,
      career: todayCareers[0].count,
      corporate: todayCorporate[0].count,
      reservation: todayReservations[0].count
    };
    
    stats.this_week = {
      contact: weekContacts[0].count,
      franchise: weekFranchises[0].count,
      career: weekCareers[0].count,
      corporate: weekCorporate[0].count,
      reservation: weekReservations[0].count
    };
    
    stats.this_month = {
      contact: monthContacts[0].count,
      franchise: monthFranchises[0].count,
      career: monthCareers[0].count,
      corporate: monthCorporate[0].count,
      reservation: monthReservations[0].count
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Get quick stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getDashboardOverview,
  getRecentActivities,
  getAnalytics,
  getSystemAlerts,
  getQuickStats
};
