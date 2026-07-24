const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  skip: (req) => {
    // Skip rate limiting for public GET APIs to avoid 429 during page loads
    if (req.method === 'GET') {
      return (
        req.path.startsWith('/api/store-menu') ||
        req.path.startsWith('/api/merchandise') ||
        req.path.startsWith('/api/merchandise-reviews') ||
        req.path.startsWith('/api/menu') ||
        req.path.startsWith('/api/home-banners') ||
        req.path.startsWith('/api/offers') ||
        req.path.startsWith('/api/events') ||
        req.path.startsWith('/api/outlets') ||
        req.path.startsWith('/api/blogs') ||
        req.path.startsWith('/api/gallery') ||
        req.path.startsWith('/api/testimonials') ||
        req.path.startsWith('/api/about-hero') ||
        req.path.startsWith('/api/menu-hero') ||
        req.path.startsWith('/api/menu-combos') ||
        req.path.startsWith('/api/outlet-hero') ||
        req.path.startsWith('/api/offers-hero') ||
        req.path.startsWith('/api/contact-hero') ||
        req.path.startsWith('/api/contact-enquiries') ||
        req.path.startsWith('/api/reservation-hero') ||
        req.path.startsWith('/api/gallery-hero') ||
        req.path.startsWith('/api/gallery-items') ||
        req.path.startsWith('/api/instagram-media') ||
        req.path.startsWith('/api/blog-hero') ||
        req.path.startsWith('/api/blog-posts') ||
        req.path.startsWith('/api/career-hero') ||
        req.path.startsWith('/api/career-jobs') ||
        req.path.startsWith('/api/career-applications') ||
        req.path.startsWith('/api/franchise-hero') ||
        req.path.startsWith('/api/corporate-hero') ||
        req.path.startsWith('/api/legal-pages') ||
        req.path.startsWith('/api/newsletter') ||
        req.path.startsWith('/api/health') ||
        req.path.startsWith('/api/seo-pages')
      )
    }
    return false
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files — with cross-origin headers so video/image media loads from frontend
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4');
    else if (filePath.endsWith('.webm')) res.setHeader('Content-Type', 'video/webm');
    else if (filePath.endsWith('.mov')) res.setHeader('Content-Type', 'video/quicktime');
  }
}));

// Database connection (non-blocking for development)
const { testConnection, pool } = require('./config/database');

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/home-banners', require('./routes/homeBannerRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/outlets', require('./routes/outletRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/app-promos', require('./routes/appPromoRoutes'));
app.use('/api/merchandise', require('./routes/merchandiseRoutes'));
app.use('/api/merchandise-categories', require('./routes/merchandiseCategoryRoutes'));
app.use('/api/merchandise-banners', require('./routes/merchandiseBannerRoutes'));
app.use('/api/merchandise-orders', require('./routes/merchandiseOrderRoutes'));
app.use('/api/merchandise-reviews', require('./routes/merchandiseReviewRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/event-bookings', require('./routes/eventBookingRoutes'));
app.use('/api/admin/events', require('./routes/adminEventRoutes'));
app.use('/api/admin/event-bookings', require('./routes/adminEventBookingRoutes'));
app.use('/api/admin/event-checkin', require('./routes/adminEventCheckinRoutes'));
app.use('/api/admin', require('./routes/adminEventMessageRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/franchise', require('./routes/franchiseRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/contact-enquiries', require('./routes/contactEnquiryRoutes'));
app.use('/api/corporate', require('./routes/corporateRoutes'));
app.use('/api/blogs', require('./routes/blogRoutes'));
app.use('/api/gallery', require('./routes/galleryRoutes'));
app.use('/api/careers', require('./routes/careerRoutes'));
app.use('/api/testimonials', require('./routes/testimonialRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/site-settings', require('./routes/siteSettingsRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/seo', require('./routes/seoRoutes'));
app.use('/api/seo-pages', require('./routes/seoPagesRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/admin-auth', require('./routes/adminAuthRoutes'));
app.use('/api/admin-users', require('./routes/adminUserRoutes'));
app.use('/api/admin-roles', require('./routes/adminRoleRoutes'));
app.use('/api/admin-permissions', require('./routes/adminPermissionRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/store-menu', require('./routes/storeMenuRoutes'));
app.use('/api/about-hero', require('./routes/aboutHeroRoutes'));
app.use('/api/menu-hero', require('./routes/menuHeroRoutes'));
app.use('/api/menu-combos', require('./routes/menuComboRoutes'));
app.use('/api/outlet-hero', require('./routes/outletHeroRoutes'));
app.use('/api/offers-hero', require('./routes/offersHeroRoutes'));
app.use('/api/contact-hero', require('./routes/contactHeroRoutes'));
app.use('/api/events-hero', require('./routes/eventsHeroRoutes'));
app.use('/api/admin/events-hero', require('./routes/adminEventsHeroRoutes'));
app.use('/api/reservation-hero', require('./routes/reservationHeroRoutes'));
app.use('/api/gallery-hero', require('./routes/galleryHeroRoutes'));
app.use('/api/gallery-items', require('./routes/galleryItemRoutes'));
app.use('/api/instagram-media', require('./routes/instagramMediaRoutes'));
app.use('/api/blog-hero', require('./routes/blogHeroRoutes'));
app.use('/api/blog-posts', require('./routes/blogPostRoutes'));
app.use('/api/career-hero', require('./routes/careerHeroRoutes'));
app.use('/api/career-jobs', require('./routes/careerJobRoutes'));
app.use('/api/career-applications', require('./routes/careerApplicationRoutes'));
app.use('/api/franchise-hero', require('./routes/franchiseHeroRoutes'));
app.use('/api/franchise-enquiries', require('./routes/franchiseEnquiryRoutes'));
app.use('/api/corporate-hero', require('./routes/corporateHeroRoutes'));
app.use('/api/corporate-enquiries', require('./routes/corporateEnquiryRoutes'));
app.use('/api/page-heroes', require('./routes/pageHeroRoutes'));
app.use('/api/admin/page-heroes', require('./routes/adminPageHeroRoutes'));
app.use('/api/legal-pages', require('./routes/legalPageRoutes'));
app.use('/api/newsletter', require('./routes/newsletterRoutes'));
app.use('/api/customer-auth', require('./routes/customerAuthRoutes'));
app.use('/api/customer-dashboard', require('./routes/customerDashboardRoutes'));
app.use('/api/admin/customers', require('./routes/adminCustomerRoutes'));
app.use('/api/customer-support', require('./routes/customerSupportRoutes'));
app.use('/api/admin-support', require('./routes/adminSupportRoutes'));
app.use('/api/admin-notifications', require('./routes/adminNotificationRoutes'));

// Default route
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Big Bean Café API Server',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Temporary DB connectivity test
app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ success: true, db: 'connected' });
  } catch (error) {
    console.error('DB test error:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection (non-blocking for development)
    testConnection().then(connected => {
      if (!connected) {
        console.warn('⚠️  Database connection failed. Some features may not work correctly.');
        console.warn('💡 Ensure MySQL is running and database credentials are correct in .env file');
      }
    }).catch(err => {
      console.warn('⚠️  Database test error:', err.message);
    });
    
    // Start server with error handling
    const server = app.listen(PORT, () => {
      console.log(`🚀 Big Bean Café API Server running on port ${PORT}`);
      console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please check if another server is running.`);
        console.log(`💡 You can try:`);
        console.log(`   1. Stop the existing server on port ${PORT}`);
        console.log(`   2. Use a different port by setting PORT environment variable`);
        console.log(`   3. Check for other Node.js processes using: netstat -ano | findstr :${PORT}`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
