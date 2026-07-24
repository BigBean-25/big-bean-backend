const { executeQuery } = require('../config/database');
const { sendAdminEmailReply, sendAdminWhatsAppReply, getLogs } = require('../services/adminReplyService');
const { getTemplate, applyVars } = require('../services/replyTemplates');
const { createAdminNotification } = require('../services/adminNotificationService');
const { getDataScopeFilter } = require('../middleware/authMiddleware');

const MODULE = 'reservations';

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NULL,
      phone VARCHAR(30) NOT NULL,
      outlet_id INT NULL,
      outlet_name VARCHAR(150) NULL,
      reservation_date DATE NOT NULL,
      reservation_time VARCHAR(50) NOT NULL,
      guests INT NOT NULL DEFAULT 2,
      special_requests TEXT NULL,
      status VARCHAR(80) DEFAULT 'pending',
      admin_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

// Ensure status column is VARCHAR (migrate ENUM if needed)
const migrateStatusCol = async () => {
  try {
    const sc = await executeQuery("SHOW COLUMNS FROM reservations LIKE 'status'");
    if (sc.length && sc[0].Type && sc[0].Type.toLowerCase().startsWith('enum')) {
      await executeQuery("ALTER TABLE reservations MODIFY COLUMN status VARCHAR(80) DEFAULT 'pending'");
    }
  } catch (e) { console.warn('reservations status migration:', e.message); }
};

const VALID_STATUSES = ['pending','confirmed','contacted','cancelled','completed','no_show'];

// Get all reservations
const getAllReservations = async (req, res) => {
  try {
    await ensureTable();
    const { status, date, search } = req.query;
    
    let query = 'SELECT r.* FROM reservations r';
    const params = [];

    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (date) {
      whereConditions.push('reservation_date = ?');
      params.push(date);
    }
    
    if (search) {
      whereConditions.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR outlet_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const scope = await getDataScopeFilter(req.admin || req.user, 'reservations', 'r');
    if (scope.clause) {
      whereConditions.push(scope.clause);
      params.push(...scope.params);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY reservation_date ASC, reservation_time ASC';

    const reservations = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: reservations
    });
    
  } catch (error) {
    console.error('Get all reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong'
    });
  }
};

// Get reservation by ID
const getReservationById = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    
    const reservation = await executeQuery(
      'SELECT * FROM reservations WHERE id = ?',
      [id]
    );
    
    if (reservation.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }
    
    res.json({
      success: true,
      data: reservation[0]
    });
    
  } catch (error) {
    console.error('Get reservation by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong'
    });
  }
};

// Create new reservation
const createReservation = async (req, res) => {
  try {
    await ensureTable();
    
    // Support both new and old field names
    const {
      full_name, name,
      email,
      phone,
      outlet_id, outlet,
      outlet_name,
      reservation_date,
      reservation_time,
      guests, numberOfPeople,
      special_requests, specialRequests
    } = req.body;
    
    const finalName = full_name || name;
    const finalOutletId = outlet_id || outlet;
    const finalOutletName = outlet_name;
    const finalGuests = guests || numberOfPeople;
    const finalSpecialRequests = special_requests || specialRequests;
    
    // Validation
    if (!finalName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Full name and phone are required'
      });
    }
    
    if (!finalOutletId && !finalOutletName) {
      return res.status(400).json({
        success: false,
        message: 'Outlet is required'
      });
    }
    
    if (!reservation_date) {
      return res.status(400).json({
        success: false,
        message: 'Reservation date is required'
      });
    }
    
    if (!reservation_time) {
      return res.status(400).json({
        success: false,
        message: 'Reservation time is required'
      });
    }
    
    if (!finalGuests || finalGuests < 1 || finalGuests > 20) {
      return res.status(400).json({
        success: false,
        message: 'Guests must be between 1 and 20'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO reservations (
        full_name, email, phone, outlet_id, outlet_name,
        reservation_date, reservation_time, guests, special_requests, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalName, email, phone, finalOutletId, finalOutletName,
        reservation_date, reservation_time, finalGuests, finalSpecialRequests, 'pending'
      ]
    );

    // Create admin notification for new reservation
    createAdminNotification({
      type: 'reservation',
      title: 'New Reservation Request',
      message: `New reservation from ${finalName} for ${finalGuests} guests on ${reservation_date} at ${reservation_time}`,
      module_name: 'reservations',
      record_id: result.insertId,
      action_url: `/admin/reservations/${result.insertId}`,
      priority: 'high',
      created_by_type: 'guest',
      created_by_id: null,
      metadata: { name: finalName, email, phone, outlet_name: finalOutletName, reservation_date, reservation_time, guests: finalGuests }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Reservation request received successfully.',
      data: { id: result.insertId }
    });
    
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to submit reservation. Please try again.'
    });
  }
};

// Update reservation status
const updateReservationStatus = async (req, res) => {
  try {
    await ensureTable();
    await migrateStatusCol();
    const { id } = req.params;
    const { status, admin_notes, notes } = req.body;
    const norm = String(status || '').toLowerCase().replace(/\s+/g,'_');
    const final = VALID_STATUSES.includes(norm) ? norm : null;
    if (!final) return res.status(400).json({ success: false, message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    const existingReservation = await executeQuery('SELECT id FROM reservations WHERE id = ?', [id]);
    if (existingReservation.length === 0) return res.status(404).json({ success: false, message: 'Reservation not found' });
    await executeQuery(
      'UPDATE reservations SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [final, admin_notes || notes || null, id]
    );
    res.json({ success: true, message: 'Reservation status updated successfully' });
  } catch (error) {
    console.error('Update reservation status error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const sendEmail = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Reservation not found' });
    const r = rows[0];
    const name = r.full_name || r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key || r.status);
    const vars = { name, email: r.email || '', phone: r.phone, date: r.reservation_date ? String(r.reservation_date).split('T')[0] : '', time: r.reservation_time || '', guests: r.guests || '', status: r.status };
    const applied = applyVars(tmpl, vars);
    const subject = req.body.subject || applied.subject;
    const message = req.body.message || applied.message;
    const result = await sendAdminEmailReply({ moduleName: MODULE, recordId: r.id, to: r.email, name, subject, message });
    res.status(result.success ? 200 : 400).json(result);
  } catch (e) {
    console.error('sendEmail error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const sendWhatsApp = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Reservation not found' });
    const r = rows[0];
    const name = r.full_name || r.name;
    const tmpl = getTemplate(MODULE, req.body.template_key || r.status);
    const vars = { name, phone: r.phone, date: r.reservation_date ? String(r.reservation_date).split('T')[0] : '', time: r.reservation_time || '', guests: r.guests || '', status: r.status };
    const applied = applyVars(tmpl, vars);
    const message = req.body.message || applied.whatsapp;
    const result = await sendAdminWhatsAppReply({ moduleName: MODULE, recordId: r.id, phone: r.phone, name, message });
    res.json(result);
  } catch (e) {
    console.error('sendWhatsApp error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getCommLogs = async (req, res) => {
  try {
    const logs = await getLogs(MODULE, req.params.id);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

// Delete reservation
const deleteReservation = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    
    // Check if reservation exists
    const existingReservation = await executeQuery(
      'SELECT id FROM reservations WHERE id = ?',
      [id]
    );
    
    if (existingReservation.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM reservations WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Reservation deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong'
    });
  }
};

// Get reservation statistics
const getReservationStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN reservation_date = CURDATE() THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN reservation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN reservation_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
      FROM reservations
    `);
    
    const guestStats = await executeQuery(`
      SELECT 
        SUM(CASE WHEN reservation_date = CURDATE() THEN guests ELSE 0 END) as today_guests,
        SUM(CASE WHEN reservation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN guests ELSE 0 END) as this_week_guests,
        SUM(CASE WHEN reservation_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN guests ELSE 0 END) as this_month_guests
      FROM reservations
      WHERE status != 'cancelled'
    `);
    
    res.json({
      success: true,
      data: {
        overview: stats[0],
        guests: guestStats[0]
      }
    });
    
  } catch (error) {
    console.error('Get reservation stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get available time slots for a date
const getAvailableTimeSlots = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }
    
    // Define time slots
    const timeSlots = [
      '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
      '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
      '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
      '8:00 PM', '8:30 PM', '9:00 PM'
    ];
    
    // Get booked slots
    const bookedSlots = await executeQuery(
      'SELECT DISTINCT reservation_time FROM reservations WHERE reservation_date = ? AND status != ?',
      [date, 'cancelled']
    );
    
    const bookedTimes = bookedSlots.map(slot => slot.reservation_time);
    const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));
    
    res.json({
      success: true,
      data: {
        available_slots: availableSlots,
        booked_slots: bookedTimes
      }
    });
    
  } catch (error) {
    console.error('Get available time slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservationStatus,
  sendEmail,
  sendWhatsApp,
  getCommLogs,
  deleteReservation,
  getReservationStats,
  getAvailableTimeSlots
};
