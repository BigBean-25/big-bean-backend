const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Create upload directories
ensureDirectoryExists(path.join(__dirname, '../uploads/images'));
ensureDirectoryExists(path.join(__dirname, '../uploads/videos'));
ensureDirectoryExists(path.join(__dirname, '../uploads/resumes'));
ensureDirectoryExists(path.join(__dirname, '../uploads/outlets'));
ensureDirectoryExists(path.join(__dirname, '../uploads/offers'));
ensureDirectoryExists(path.join(__dirname, '../uploads/app-promos'));

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    
    if (file.mimetype.startsWith('image/')) {
      uploadPath = path.join(__dirname, '../uploads/images');
    } else if (file.mimetype.startsWith('video/')) {
      uploadPath = path.join(__dirname, '../uploads/videos');
    } else if (file.mimetype.includes('application/pdf') || file.mimetype.includes('document')) {
      uploadPath = path.join(__dirname, '../uploads/resumes');
    } else {
      return cb(new Error('Invalid file type'), null);
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'video/mp4': true,
    'video/webm': true,
    'video/ogg': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true
  };
  
  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Maximum 5 files at once
  }
});

// Single file upload middleware
const uploadSingle = (fieldName) => upload.single(fieldName);

// Multiple files upload middleware
const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);

// Upload handler for different file types
const uploadImage = uploadSingle('image');
const uploadVideo = uploadSingle('video');
const uploadImages = uploadMultiple('images', 5);
const uploadResume = uploadSingle('resume');

// Dedicated outlet image uploader → uploads/outlets/
const outletStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/outlets'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `outlet-${uniqueSuffix}${ext}`);
  }
});

const outletUpload = multer({
  storage: outletStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Dedicated offer image uploader → uploads/offers/
const offerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/offers'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `offer-${uniqueSuffix}${ext}`);
  }
});

const offerUpload = multer({
  storage: offerStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Dedicated merchandise image uploader → uploads/merchandise/
ensureDirectoryExists(path.join(__dirname, '../uploads/merchandise'));

const merchandiseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/merchandise'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `merch-${uniqueSuffix}${ext}`);
  }
});

const merchandiseUpload = multer({
  storage: merchandiseStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Dedicated event image uploader → uploads/events/
ensureDirectoryExists(path.join(__dirname, '../uploads/events'));

const eventStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/events'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `event-${uniqueSuffix}${ext}`);
  }
});

const eventUpload = multer({
  storage: eventStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Dedicated app-promo image uploader → uploads/app-promos/
const appPromoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/app-promos'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `app-promo-${uniqueSuffix}${ext}`);
  }
});

const appPromoUpload = multer({
  storage: appPromoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Dedicated merchandise category image uploader → uploads/merchandise-categories/
ensureDirectoryExists(path.join(__dirname, '../uploads/merchandise-categories'));

const merchandiseCategoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/merchandise-categories'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `merch-cat-${uniqueSuffix}${ext}`);
  }
});

const merchandiseCategoryUpload = multer({
  storage: merchandiseCategoryStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Dedicated menu-hero image uploader → uploads/menu-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/menu-hero'));

const menuHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/menu-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `menu-hero-${uniqueSuffix}${ext}`);
  }
});

const menuHeroUpload = multer({
  storage: menuHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated menu-combos image uploader → uploads/menu-combos/
ensureDirectoryExists(path.join(__dirname, '../uploads/menu-combos'));

const menuComboStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/menu-combos'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `menu-combo-${uniqueSuffix}${ext}`);
  }
});

const menuComboUpload = multer({
  storage: menuComboStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated outlet-hero image uploader → uploads/outlet-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/outlet-hero'));

const outletHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/outlet-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `outlet-hero-${uniqueSuffix}${ext}`);
  }
});

const outletHeroUpload = multer({
  storage: outletHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated about-hero image uploader → uploads/about-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/about-hero'));

const aboutHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/about-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `about-hero-${uniqueSuffix}${ext}`);
  }
});

const aboutHeroUpload = multer({
  storage: aboutHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated merchandise banner image uploader → uploads/merchandise-banners/
ensureDirectoryExists(path.join(__dirname, '../uploads/merchandise-banners'));

const merchandiseBannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/merchandise-banners'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `merch-banner-${uniqueSuffix}${ext}`);
  }
});

const merchandiseBannerUpload = multer({
  storage: merchandiseBannerStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Dedicated offers-hero image uploader → uploads/offers-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/offers-hero'));

const offersHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/offers-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `offers-hero-${uniqueSuffix}${ext}`);
  }
});

const offersHeroUpload = multer({
  storage: offersHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated contact-hero image uploader → uploads/contact-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/contact-hero'));

const contactHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/contact-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `contact-hero-${uniqueSuffix}${ext}`);
  }
});

const contactHeroUpload = multer({
  storage: contactHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated events-hero image uploader → uploads/events-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/events-hero'));

const eventsHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/events-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `events-hero-${uniqueSuffix}${ext}`);
  }
});

const eventsHeroUpload = multer({
  storage: eventsHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated reservation-hero image uploader → uploads/reservation-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/reservation-hero'));

const reservationHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/reservation-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `reservation-hero-${uniqueSuffix}${ext}`);
  }
});

const reservationHeroUpload = multer({
  storage: reservationHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated gallery-hero image uploader → uploads/gallery-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/gallery-hero'));

const galleryHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/gallery-hero'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `gallery-hero-${uniqueSuffix}${ext}`);
  }
});

const galleryHeroUpload = multer({
  storage: galleryHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated gallery item uploader → uploads/gallery/ (image + video)
ensureDirectoryExists(path.join(__dirname, '../uploads/gallery'));

const galleryItemStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/gallery'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `gallery-${uniqueSuffix}${ext}`);
  }
});

const galleryItemUpload = multer({
  storage: galleryItemStorage,
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (imageTypes.includes(file.mimetype) || videoTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, png, webp images and mp4/webm/mov videos are allowed'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Dedicated blog-hero image uploader → uploads/blog-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/blog-hero'));

const blogHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/blog-hero')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `blog-hero-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const blogHeroUpload = multer({
  storage: blogHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated blog post featured image uploader → uploads/blog/
ensureDirectoryExists(path.join(__dirname, '../uploads/blog'));

const blogPostStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/blog')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `blog-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const blogPostUpload = multer({
  storage: blogPostStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Franchise hero image uploader → uploads/franchise-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/franchise-hero'));

const franchiseHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/franchise-hero')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `franchise-hero-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const franchiseHeroUpload = multer({
  storage: franchiseHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Legal pages hero image uploader → uploads/legal-pages/
ensureDirectoryExists(path.join(__dirname, '../uploads/legal-pages'));

const legalPageStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/legal-pages')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `legal-page-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const legalPageUpload = multer({
  storage: legalPageStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Corporate hero image uploader → uploads/corporate-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/corporate-hero'));

const corporateHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/corporate-hero')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `corporate-hero-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const corporateHeroUpload = multer({
  storage: corporateHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated page-heroes image uploader → uploads/page-heroes/
ensureDirectoryExists(path.join(__dirname, '../uploads/page-heroes'));

const pageHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/page-heroes')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `page-hero-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const pageHeroUpload = multer({
  storage: pageHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Dedicated career-hero image uploader → uploads/career-hero/
ensureDirectoryExists(path.join(__dirname, '../uploads/career-hero'));

const careerHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/career-hero')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `career-hero-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const careerHeroUpload = multer({
  storage: careerHeroStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Career resume uploader → uploads/careers/resumes/
ensureDirectoryExists(path.join(__dirname, '../uploads/careers/resumes'));

const careerResumeStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(__dirname, '../uploads/careers/resumes')); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const careerResumeUpload = multer({
  storage: careerResumeStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX files are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadImage,
  uploadVideo,
  uploadImages,
  uploadResume,
  outletUpload,
  offerUpload,
  merchandiseUpload,
  merchandiseCategoryUpload,
  merchandiseBannerUpload,
  eventUpload,
  appPromoUpload,
  aboutHeroUpload,
  menuHeroUpload,
  menuComboUpload,
  outletHeroUpload,
  offersHeroUpload,
  contactHeroUpload,
  eventsHeroUpload,
  reservationHeroUpload,
  galleryHeroUpload,
  galleryItemUpload,
  blogHeroUpload,
  blogPostUpload,
  careerHeroUpload,
  careerResumeUpload,
  franchiseHeroUpload,
  corporateHeroUpload,
  legalPageUpload,
  pageHeroUpload
};
