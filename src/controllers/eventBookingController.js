const crypto = require('crypto');
const qrcode = require('qrcode');
const { executeQuery, pool } = require('../config/database');
const { generateTicketPdf } = require('../services/eventTicketPdfService');
const { sendEventTicketEmail } = require('../services/mailService');
const { createAdminNotification } = require('../services/adminNotificationService');

const getSetting = async (key) => {
  const rows = await executeQuery('SELECT setting_value FROM site_settings WHERE setting_key = ?', [key]);
  return rows.length ? rows[0].setting_value : null;
};

const getSettings = async (keys) => {
  const rows = await executeQuery(
    `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
    keys
  );
  const map = {};
  rows.forEach(r => { map[r.setting_key] = r.setting_value; });
  return map;
};

let qrColumnEnsured = false;
const ensureQrCodeColumn = async () => {
  if (qrColumnEnsured) return;
  qrColumnEnsured = true;
  try {
    const cols = await executeQuery('SHOW COLUMNS FROM cafe_event_bookings');
    const existing = cols.find(c => c.Field === 'qr_code');
    if (!existing) {
      await executeQuery('ALTER TABLE cafe_event_bookings ADD COLUMN qr_code LONGTEXT NULL');
    }
  } catch (error) {
    console.error('ensureQrCodeColumn error:', error.message);
  }
};

let bookingColumnsEnsured = false;
const ensureEventBookingColumns = async () => {
  if (bookingColumnsEnsured) return;
  bookingColumnsEnsured = true;
  try {
    const cols = await executeQuery('SHOW COLUMNS FROM cafe_event_bookings');
    const existing = new Set(cols.map(c => c.Field));
    const toAdd = [
      ['booking_number', 'VARCHAR(255) NULL'],
      ['event_id', 'INT NULL'],
      ['event_date_id', 'INT NULL'],
      ['ticket_type_id', 'INT NULL'],
      ['outlet_id', 'INT NULL'],
      ['customer_name', 'VARCHAR(255) NULL'],
      ['customer_email', 'VARCHAR(255) NULL'],
      ['customer_phone', 'VARCHAR(255) NULL'],
      ['quantity', 'INT NULL'],
      ['ticket_price', 'DECIMAL(10,2) NULL'],
      ['subtotal', 'DECIMAL(10,2) NULL'],
      ['tax_amount', 'DECIMAL(10,2) NULL'],
      ['total_amount', 'DECIMAL(10,2) NULL'],
      ['payment_method', 'VARCHAR(50) NULL'],
      ['payment_status', 'VARCHAR(50) NULL'],
      ['booking_status', 'VARCHAR(50) NULL'],
      ['razorpay_order_id', 'VARCHAR(255) NULL'],
      ['razorpay_payment_id', 'VARCHAR(255) NULL'],
      ['razorpay_signature', 'TEXT NULL'],
      ['notes', 'TEXT NULL'],
      ['qr_code', 'LONGTEXT NULL'],
    ];
    for (const [col, def] of toAdd) {
      if (!existing.has(col)) {
        await executeQuery(`ALTER TABLE cafe_event_bookings ADD COLUMN ${col} ${def}`);
        console.log(`Added missing column ${col} to cafe_event_bookings`);
      }
    }
  } catch (error) {
    console.error('ensureEventBookingColumns error:', error.message);
  }
};

let dateColumnsEnsured = false;
const ensureEventDateColumns = async () => {
  if (dateColumnsEnsured) return;
  dateColumnsEnsured = true;
  try {
    const cols = await executeQuery('SHOW COLUMNS FROM cafe_event_dates');
    const existing = new Set(cols.map(c => c.Field));
    const toAdd = [
      ['event_id', 'INT NULL'],
      ['event_date', 'DATE NULL'],
      ['start_time', 'TIME NULL'],
      ['end_time', 'TIME NULL'],
      ['door_open_time', 'TIME NULL'],
      ['display_time_label', 'VARCHAR(255) NULL'],
      ['total_seats', 'INT NULL'],
      ['available_seats', 'INT NULL'],
      ['status', 'VARCHAR(50) NULL'],
    ];
    for (const [col, def] of toAdd) {
      if (!existing.has(col)) {
        await executeQuery(`ALTER TABLE cafe_event_dates ADD COLUMN ${col} ${def}`);
        console.log(`Added missing column ${col} to cafe_event_dates`);
      }
    }
  } catch (error) {
    console.error('ensureEventDateColumns error:', error.message);
  }
};

let ticketColumnsEnsured = false;
const ensureEventTicketColumns = async () => {
  if (ticketColumnsEnsured) return;
  ticketColumnsEnsured = true;
  try {
    const cols = await executeQuery('SHOW COLUMNS FROM cafe_event_ticket_types');
    const existing = new Set(cols.map(c => c.Field));
    const toAdd = [
      ['event_id', 'INT NULL'],
      ['ticket_name', 'VARCHAR(255) NULL'],
      ['ticket_description', 'TEXT NULL'],
      ['price', 'DECIMAL(10,2) NULL'],
      ['mrp', 'DECIMAL(10,2) NULL'],
      ['total_quantity', 'INT NULL'],
      ['available_quantity', 'INT NULL'],
      ['max_per_booking', 'INT NULL'],
      ['status', 'VARCHAR(50) NULL'],
    ];
    for (const [col, def] of toAdd) {
      if (!existing.has(col)) {
        await executeQuery(`ALTER TABLE cafe_event_ticket_types ADD COLUMN ${col} ${def}`);
        console.log(`Added missing column ${col} to cafe_event_ticket_types`);
      }
    }
  } catch (error) {
    console.error('ensureEventTicketColumns error:', error.message);
  }
};

const generateBookingNumber = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BBC-EVT-${y}${m}${d}-${random}`;
};

const createOrder = async (req, res) => {
  try {
    await ensureEventBookingColumns();
    await ensureEventDateColumns();
    await ensureEventTicketColumns();
    await ensureQrCodeColumn();

    const { event_id, event_date_id, ticket_type_id, customer_name, customer_phone, customer_email, notes, quantity } = req.body;

    const missing = [];
    if (!event_id) missing.push('event_id');
    if (!event_date_id) missing.push('event_date_id');
    if (!ticket_type_id) missing.push('ticket_type_id');
    if (!customer_name || String(customer_name).trim() === '') missing.push('customer_name');
    if (!customer_phone || String(customer_phone).trim() === '') missing.push('customer_phone');
    if (quantity === undefined || quantity === null || quantity === '') missing.push('quantity');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missing,
      });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const settings = await getSettings([
      'payment_enabled',
      'online_payment_enabled',
      'razorpay_key_id',
      'razorpay_key_secret',
      'currency',
    ]);

    if (settings.payment_enabled !== '1') {
      return res.status(400).json({ success: false, message: 'Payments are currently disabled.' });
    }
    if (settings.online_payment_enabled !== '1') {
      return res.status(400).json({ success: false, message: 'Online payment is not enabled.' });
    }
    if (!settings.razorpay_key_id || !settings.razorpay_key_secret || settings.razorpay_key_secret === '********' || settings.razorpay_key_secret.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Razorpay payment is not configured. Please check payment settings.',
      });
    }

    const events = await executeQuery('SELECT id, title, status FROM cafe_events WHERE id = ? AND status = ?', [event_id, 'active']);
    if (!events.length) {
      return res.status(400).json({ success: false, message: 'Event is not active or does not exist.' });
    }

    const dates = await executeQuery('SELECT * FROM cafe_event_dates WHERE id = ? AND event_id = ? AND status = ?', [event_date_id, event_id, 'active']);
    if (!dates.length) {
      return res.status(400).json({ success: false, message: 'Selected event date is not available.' });
    }
    const eventDate = dates[0];
    if (eventDate.available_seats < qty) {
      return res.status(400).json({ success: false, message: 'Not enough seats available for the selected date.' });
    }

    const tickets = await executeQuery('SELECT * FROM cafe_event_ticket_types WHERE id = ? AND event_id = ? AND status = ?', [ticket_type_id, event_id, 'active']);
    if (!tickets.length) {
      return res.status(400).json({ success: false, message: 'Selected ticket type is not available.' });
    }
    const ticket = tickets[0];
    if (ticket.available_quantity < qty) {
      return res.status(400).json({ success: false, message: 'Not enough tickets available.' });
    }
    if (ticket.max_per_booking < qty) {
      return res.status(400).json({ success: false, message: `Maximum ${ticket.max_per_booking} tickets allowed per booking.` });
    }

    const outlets = await executeQuery('SELECT id FROM cafe_event_outlets WHERE event_id = ? LIMIT 1', [event_id]);
    const event_outlet_id = outlets.length ? outlets[0].id : null;

    const subtotal = Number(ticket.price) * qty;
    const tax_amount = 0;
    const total_amount = subtotal + tax_amount;

    const bookingNumber = generateBookingNumber();

    let rzpOrder;
    try {
      const Razorpay = require('razorpay');
      const rzp = new Razorpay({
        key_id: settings.razorpay_key_id,
        key_secret: settings.razorpay_key_secret,
      });

      rzpOrder = await rzp.orders.create({
        amount: Math.round(total_amount * 100),
        currency: settings.currency || 'INR',
        receipt: bookingNumber,
        notes: {
          booking_number: bookingNumber,
          event_id: String(event_id),
        },
      });
    } catch (rzpError) {
      console.error('Razorpay create order error:', rzpError);
      const rzpMsg = rzpError?.error?.description || rzpError?.message || 'Razorpay order creation failed.';
      return res.status(400).json({ success: false, message: `Payment gateway error: ${rzpMsg}` });
    }

    const insertResult = await executeQuery(
      `INSERT INTO cafe_event_bookings
        (booking_number, event_id, event_date_id, ticket_type_id, outlet_id, customer_name, customer_email, customer_phone, quantity, ticket_price, subtotal, tax_amount, total_amount, payment_method, payment_status, booking_status, razorpay_order_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingNumber,
        event_id,
        event_date_id,
        ticket_type_id,
        event_outlet_id,
        customer_name.trim(),
        customer_email || null,
        customer_phone.trim(),
        qty,
        ticket.price,
        subtotal,
        tax_amount,
        total_amount,
        'online',
        'payment_initiated',
        'pending',
        rzpOrder.id,
        notes || null,
      ]
    );

    try {
      await createAdminNotification({
        type: 'event_booking',
        title: 'New Event Ticket Booking',
        message: `${customer_name.trim()} booked ${events[0].title}`,
        module_name: 'event_bookings',
        record_id: insertResult.insertId,
        action_url: '/admin/event-bookings',
        priority: 'normal',
      });
    } catch (notifyError) {
      console.warn('Failed to send new booking admin notification:', notifyError.message);
    }

    res.json({
      success: true,
      data: {
        booking_id: insertResult.insertId,
        booking_number: bookingNumber,
        razorpay_order_id: rzpOrder.id,
        razorpay_key_id: settings.razorpay_key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
      },
    });
  } catch (error) {
    console.error('Event create-order error:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      stack: error.stack,
    });
    res.status(400).json({
      success: false,
      message: 'Unable to create event booking order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const verifyPayment = async (req, res) => {
  let connection;
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'All payment fields are required.' });
    }

    const secret = await getSetting('razorpay_key_secret');
    if (!secret || secret === '********' || secret.trim() === '') {
      return res.status(500).json({ success: false, message: 'Razorpay secret is not configured.' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expected.length !== razorpay_signature.length) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(razorpay_signature, 'hex'));
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [bookings] = await connection.execute(
      `SELECT
        b.*,
        e.title AS event_title,
        DATE_FORMAT(d.event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(d.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(d.end_time, '%H:%i') AS end_time,
        o.outlet_name, o.outlet_address,
        t.ticket_name
      FROM cafe_event_bookings b
      JOIN cafe_events e ON e.id = b.event_id
      JOIN cafe_event_dates d ON d.id = b.event_date_id
      JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
      LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
      WHERE b.id = ? AND b.razorpay_order_id = ?
      FOR UPDATE`,
      [booking_id, razorpay_order_id]
    );

    if (!bookings.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bookings[0];

    if (booking.payment_status === 'paid') {
      await connection.commit();
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          booking_number: booking.booking_number,
          booking_status: booking.booking_status,
          payment_status: booking.payment_status,
        },
      });
    }

    await connection.execute(
      `UPDATE cafe_event_bookings
       SET payment_status = 'paid', booking_status = 'confirmed', razorpay_payment_id = ?, razorpay_signature = ?
       WHERE id = ?`,
      [razorpay_payment_id, razorpay_signature, booking_id]
    );

    await connection.execute(
      `UPDATE cafe_event_dates
       SET available_seats = available_seats - ?, status = CASE WHEN (available_seats - ?) <= 0 THEN 'sold_out' ELSE status END
       WHERE id = ? AND available_seats >= ?`,
      [booking.quantity, booking.quantity, booking.event_date_id, booking.quantity]
    );

    await connection.execute(
      `UPDATE cafe_event_ticket_types
       SET available_quantity = available_quantity - ?, status = CASE WHEN (available_quantity - ?) <= 0 THEN 'sold_out' ELSE status END
       WHERE id = ? AND available_quantity >= ?`,
      [booking.quantity, booking.quantity, booking.ticket_type_id, booking.quantity]
    );

    await connection.commit();
    connection.release();
    connection = null;

    try {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bigbeancafe.in';
      const qrData = {
        booking_number: booking.booking_number,
        event_id: booking.event_id,
        customer_phone: booking.customer_phone,
        status: 'confirmed',
        checkin_url: `${FRONTEND_URL}/events/checkin/${booking.booking_number}`,
      };
      const qrDataString = JSON.stringify(qrData);
      await executeQuery('UPDATE cafe_event_bookings SET qr_code = ? WHERE id = ?', [qrDataString, booking_id]);
    } catch (qrError) {
      console.error('QR generation error:', qrError.message);
    }

    if (booking.customer_email) {
      try {
        await sendEventTicketEmail(booking);
      } catch (emailError) {
        console.error('Event ticket email error:', emailError.message);
      }
    }

    try {
      await createAdminNotification({
        type: 'event_payment',
        title: 'Event Payment Confirmed',
        message: `${booking.customer_name} paid ₹${Number(booking.total_amount).toFixed(2)} for ${booking.event_title}`,
        module_name: 'event_bookings',
        record_id: booking.id,
        action_url: '/admin/event-bookings',
        priority: 'normal',
      });
    } catch (notifyError) {
      console.warn('Failed to send payment admin notification:', notifyError.message);
    }

    res.json({
      success: true,
      message: 'Payment verified and booking confirmed',
      data: {
        booking_number: booking.booking_number,
        booking_status: 'confirmed',
        payment_status: 'paid',
      },
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
      connection.release();
    }
    console.error('verifyPayment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during payment verification.' });
  }
};

const markPaymentFailed = async (req, res) => {
  try {
    const { booking_id, reason } = req.body;
    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    await executeQuery(
      `UPDATE cafe_event_bookings
       SET payment_status = 'failed', booking_status = 'pending', notes = CONCAT(COALESCE(notes, ''), ' Failure: ', ?)
       WHERE id = ?`,
      [reason || 'Payment failed', booking_id]
    );

    res.json({ success: true, message: 'Payment marked as failed.' });
  } catch (error) {
    console.error('markPaymentFailed error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark payment as failed.' });
  }
};

const getBookingByNumber = async (req, res) => {
  try {
    await ensureQrCodeColumn();
    const { bookingNumber } = req.params;

    const rows = await executeQuery(
      `SELECT
        b.id, b.booking_number, b.customer_name, b.customer_email, b.customer_phone,
        b.quantity, b.ticket_price, b.subtotal, b.tax_amount, b.total_amount,
        b.payment_status, b.booking_status, b.razorpay_payment_id, b.qr_code, b.notes, b.created_at,
        e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
        e.event_banner, e.event_thumbnail,
        DATE_FORMAT(d.event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(d.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(d.end_time, '%H:%i') AS end_time,
        TIME_FORMAT(d.door_open_time, '%H:%i') AS door_open_time,
        t.ticket_name,
        o.outlet_name, o.outlet_address, o.city
      FROM cafe_event_bookings b
      JOIN cafe_events e ON e.id = b.event_id
      JOIN cafe_event_dates d ON d.id = b.event_date_id
      JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
      LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
      WHERE b.booking_number = ?
      LIMIT 1`,
      [bookingNumber]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = rows[0];
    let qrCodeDataUrl = null;
    if (booking.qr_code) {
      try {
        qrCodeDataUrl = await qrcode.toDataURL(booking.qr_code);
      } catch (qrError) {
        console.error('QR data URL error:', qrError.message);
      }
    }

    res.json({
      success: true,
      data: {
        booking_number: booking.booking_number,
        booking_status: booking.booking_status,
        payment_status: booking.payment_status,
        razorpay_payment_id: booking.razorpay_payment_id,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        customer_email: booking.customer_email,
        quantity: booking.quantity,
        ticket_price: Number(booking.ticket_price),
        subtotal: Number(booking.subtotal),
        tax_amount: Number(booking.tax_amount),
        total_amount: Number(booking.total_amount),
        notes: booking.notes,
        created_at: booking.created_at,
        qr_code: qrCodeDataUrl,
        event: {
          id: booking.event_id,
          title: booking.event_title,
          slug: booking.event_slug,
          image: booking.event_banner || booking.event_thumbnail,
        },
        event_date: booking.event_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        door_open_time: booking.door_open_time,
        ticket_name: booking.ticket_name,
        outlet: {
          name: booking.outlet_name,
          address: booking.outlet_address,
          city: booking.city,
        },
      },
    });
  } catch (error) {
    console.error('getBookingByNumber error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const downloadTicketPdf = async (req, res) => {
  try {
    await ensureQrCodeColumn();
    const { bookingNumber } = req.params;

    const rows = await executeQuery(
      `SELECT
        b.id, b.booking_number, b.customer_name, b.customer_email, b.customer_phone,
        b.quantity, b.ticket_price, b.subtotal, b.tax_amount, b.total_amount,
        b.payment_status, b.booking_status, b.razorpay_payment_id, b.qr_code,
        e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
        e.event_banner, e.event_thumbnail,
        DATE_FORMAT(d.event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(d.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(d.end_time, '%H:%i') AS end_time,
        TIME_FORMAT(d.door_open_time, '%H:%i') AS door_open_time,
        t.ticket_name,
        o.outlet_name, o.outlet_address, o.city
      FROM cafe_event_bookings b
      JOIN cafe_events e ON e.id = b.event_id
      JOIN cafe_event_dates d ON d.id = b.event_date_id
      JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
      LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
      WHERE b.booking_number = ?
      LIMIT 1`,
      [bookingNumber]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = rows[0];
    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Ticket PDF available only after successful payment.' });
    }

    const pdfBuffer = await generateTicketPdf({
      booking_number: booking.booking_number,
      event_title: booking.event_title,
      event_slug: booking.event_slug,
      event_date: booking.event_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      door_open_time: booking.door_open_time,
      outlet_name: booking.outlet_name,
      outlet_address: booking.outlet_address,
      outlet_city: booking.city,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      customer_email: booking.customer_email,
      ticket_name: booking.ticket_name,
      quantity: booking.quantity,
      total_amount: booking.total_amount,
      payment_status: booking.payment_status,
      booking_status: booking.booking_status,
      razorpay_payment_id: booking.razorpay_payment_id,
      qr_code: booking.qr_code,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BigBean_Event_Ticket_${booking.booking_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('downloadTicketPdf error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate ticket PDF.' });
  }
};

module.exports = { createOrder, verifyPayment, markPaymentFailed, getBookingByNumber, downloadTicketPdf };
