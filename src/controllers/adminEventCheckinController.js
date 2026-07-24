const { pool } = require('../config/database');
const { createAdminNotification } = require('../services/adminNotificationService');

const latestCheckinSubquery = `
  SELECT c1.*
  FROM cafe_event_checkins c1
  INNER JOIN (
    SELECT booking_id, MAX(id) AS id
    FROM cafe_event_checkins
    GROUP BY booking_id
  ) c2 ON c1.id = c2.id
`;

const extractBookingNumber = (qrData) => {
  if (!qrData) return null;
  const str = String(qrData).trim();

  // Try to parse as JSON containing a booking number or check-in URL
  try {
    const parsed = JSON.parse(str);
    if (parsed && parsed.booking_number) {
      return String(parsed.booking_number).trim();
    }
    if (parsed && parsed.checkin_url) {
      const url = String(parsed.checkin_url);
      const parts = url.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last.trim();
    }
  } catch (e) {
    // Not JSON, continue
  }

  // If it looks like a URL, take the last path segment
  if (str.includes('/')) {
    const parts = str.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.trim();
  }

  // Plain booking number
  return str;
};

const lookupBooking = async (req, res) => {
  try {
    const { qr_data } = req.body;
    const bookingNumber = extractBookingNumber(qr_data);

    if (!bookingNumber) {
      return res.status(400).json({ success: false, message: 'QR data or booking number is required.' });
    }

    const [rows] = await pool.execute(
      `SELECT
        b.id, b.booking_number, b.customer_name, b.customer_phone, b.customer_email,
        b.quantity, b.payment_status, b.booking_status,
        e.id AS event_id, e.title AS event_title,
        DATE_FORMAT(d.event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(d.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(d.end_time, '%H:%i') AS end_time,
        t.ticket_name,
        o.outlet_name,
        c.id AS checkin_id, c.checked_in_at, c.checked_in_by
      FROM cafe_event_bookings b
      JOIN cafe_events e ON e.id = b.event_id
      JOIN cafe_event_dates d ON d.id = b.event_date_id
      JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
      LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
      LEFT JOIN (${latestCheckinSubquery}) c ON c.booking_id = b.id
      WHERE b.booking_number = ?
      LIMIT 1`,
      [bookingNumber]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = rows[0];
    const checkedIn = !!booking.checkin_id;
    const data = {
      id: booking.id,
      booking_number: booking.booking_number,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      customer_email: booking.customer_email,
      quantity: Number(booking.quantity),
      payment_status: booking.payment_status,
      booking_status: booking.booking_status,
      event_id: booking.event_id,
      event_name: booking.event_title,
      event_date: booking.event_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      ticket_type: booking.ticket_name,
      outlet_name: booking.outlet_name,
      checked_in: checkedIn,
      checked_in_at: booking.checked_in_at,
    };

    if (booking.booking_status === 'cancelled') {
      return res.status(200).json({ success: false, message: 'Booking cancelled. Entry not allowed.', data });
    }

    if (booking.payment_status !== 'paid') {
      return res.status(200).json({ success: false, message: 'Payment not completed. Entry not allowed.', data });
    }

    if (checkedIn) {
      return res.status(200).json({ success: true, already_checked_in: true, message: 'This ticket is already checked in.', data });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('lookupBooking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const confirmCheckin = async (req, res) => {
  let connection;
  try {
    const { booking_id } = req.body;
    const adminId = req.admin?.id;

    if (!booking_id) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [bookings] = await connection.execute(
      'SELECT * FROM cafe_event_bookings WHERE id = ? FOR UPDATE',
      [booking_id]
    );

    if (!bookings.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bookings[0];

    if (booking.booking_status === 'checked_in') {
      await connection.commit();
      return res.json({ success: true, message: 'This ticket is already checked in.' });
    }

    if (booking.booking_status !== 'confirmed') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Booking must be confirmed to check in.' });
    }

    if (booking.payment_status !== 'paid') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Payment must be completed to check in.' });
    }

    const [existingCheckins] = await connection.execute(
      'SELECT id FROM cafe_event_checkins WHERE booking_id = ?',
      [booking_id]
    );

    if (existingCheckins.length) {
      await connection.commit();
      return res.json({ success: true, message: 'This ticket is already checked in.' });
    }

    await connection.execute(
      'INSERT INTO cafe_event_checkins (booking_id, checked_in_by, remarks) VALUES (?, ?, ?)',
      [booking_id, adminId || null, 'Checked in via QR scanner']
    );

    await connection.execute(
      "UPDATE cafe_event_bookings SET booking_status = 'checked_in' WHERE id = ?",
      [booking_id]
    );

    await connection.commit();

    try {
      const [eventRows] = await pool.execute('SELECT title FROM cafe_events WHERE id = ?', [booking.event_id]);
      const eventTitle = eventRows[0]?.title || 'Event';
      await createAdminNotification({
        type: 'event_checkin',
        title: 'Ticket Checked In',
        message: `${booking.customer_name} (${booking.booking_number}) checked in for ${eventTitle}`,
        module_name: 'event_bookings',
        record_id: booking.id,
        action_url: '/admin/event-bookings',
        priority: 'normal',
      });
    } catch (notifyError) {
      console.warn('Failed to send check-in admin notification:', notifyError.message);
    }

    res.json({ success: true, message: 'Check-in successful' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('confirmCheckin error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during check-in.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { lookupBooking, confirmCheckin };
