const { executeQuery, pool } = require('../config/database');
const qrcode = require('qrcode');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const escapeLike = (str) => String(str).replace(/[\\%_]/g, '\\$&');

const toBool = (v) => {
  if (v === true || v === 1) return true;
  const s = String(v || '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (time) => {
  if (!time) return '';
  const [h, m] = String(time).split(':');
  const hh = parseInt(h, 10);
  const am = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${m} ${am}`;
};

const buildWhereClause = (params) => {
  const filters = ['1=1'];
  const values = [];

  if (params.search) {
    const s = `%${escapeLike(params.search)}%`;
    filters.push(`(
      b.booking_number LIKE ? OR
      b.customer_name LIKE ? OR
      b.customer_phone LIKE ? OR
      b.customer_email LIKE ? OR
      b.razorpay_payment_id LIKE ? OR
      e.title LIKE ?
    )`);
    values.push(s, s, s, s, s, s);
  }

  if (params.event_id) {
    filters.push('b.event_id = ?');
    values.push(params.event_id);
  }

  if (params.outlet_name) {
    filters.push('o.outlet_name = ?');
    values.push(params.outlet_name);
  }

  if (params.event_date) {
    filters.push('d.event_date = ?');
    values.push(params.event_date);
  }

  if (params.from_date) {
    filters.push('d.event_date >= ?');
    values.push(params.from_date);
  }

  if (params.to_date) {
    filters.push('d.event_date <= ?');
    values.push(params.to_date);
  }

  if (params.payment_status) {
    filters.push('b.payment_status = ?');
    values.push(params.payment_status);
  }

  if (params.booking_status) {
    filters.push('b.booking_status = ?');
    values.push(params.booking_status);
  }

  if (params.checkin_status === 'checked_in') {
    filters.push('c.checked_in_at IS NOT NULL');
  } else if (params.checkin_status === 'not_checked_in') {
    filters.push('c.checked_in_at IS NULL');
  }

  return { clause: filters.join(' AND '), params: values };
};

const latestCheckinSubquery = `
  SELECT c1.*
  FROM cafe_event_checkins c1
  INNER JOIN (
    SELECT booking_id, MAX(id) AS id
    FROM cafe_event_checkins
    GROUP BY booking_id
  ) c2 ON c1.id = c2.id
`;

const baseSelect = `
  SELECT
    b.id, b.booking_number, b.customer_name, b.customer_email, b.customer_phone,
    b.quantity, b.ticket_price, b.subtotal, b.tax_amount, b.total_amount,
    b.payment_status, b.booking_status, b.razorpay_payment_id, b.qr_code, b.notes,
    b.created_at, b.updated_at,
    e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
    DATE_FORMAT(d.event_date, '%Y-%m-%d') AS event_date,
    TIME_FORMAT(d.start_time, '%H:%i') AS start_time,
    TIME_FORMAT(d.end_time, '%H:%i') AS end_time,
    TIME_FORMAT(d.door_open_time, '%H:%i') AS door_open_time,
    t.ticket_name,
    o.outlet_name, o.outlet_address, o.city,
    c.id AS checkin_id, c.checked_in_at, c.checked_in_by, c.remarks,
    au.name AS checked_in_by_name
  FROM cafe_event_bookings b
  JOIN cafe_events e ON e.id = b.event_id
  JOIN cafe_event_dates d ON d.id = b.event_date_id
  JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
  LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
  LEFT JOIN (${latestCheckinSubquery}) c ON c.booking_id = b.id
  LEFT JOIN admin_users au ON au.id = c.checked_in_by
`;

const getFilteredBookings = async (params, options = {}) => {
  const { clause, params: values } = buildWhereClause(params);
  const { page = 1, limit = 20, paginate = true } = options;
  const sort = 'ORDER BY b.created_at DESC';
  const limitNum = Math.max(1, Number(limit));
  const offsetNum = (Number(page) - 1) * limitNum;
  const rows = paginate
    ? await executeQuery(`${baseSelect} WHERE ${clause} ${sort} LIMIT ${limitNum} OFFSET ${offsetNum}`, values)
    : await executeQuery(`${baseSelect} WHERE ${clause} ${sort}`, values);
  return rows;
};

const getSummary = async (params) => {
  const { clause, params: values } = buildWhereClause(params);
  const summaryRows = await executeQuery(`
    SELECT
      COUNT(DISTINCT b.id) AS total,
      SUM(CASE WHEN b.booking_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN c.checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS checked_in,
      SUM(CASE WHEN b.booking_status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN b.booking_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN b.payment_status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(b.total_amount) AS total_revenue,
      SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE 0 END) AS paid_revenue
    FROM cafe_event_bookings b
    JOIN cafe_events e ON e.id = b.event_id
    JOIN cafe_event_dates d ON d.id = b.event_date_id
    JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
    LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
    LEFT JOIN (${latestCheckinSubquery}) c ON c.booking_id = b.id
    WHERE ${clause}
  `, values);

  const row = summaryRows[0] || {};
  return {
    total_bookings: Number(row.total) || 0,
    confirmed: Number(row.confirmed) || 0,
    checked_in: Number(row.checked_in) || 0,
    pending: Number(row.pending) || 0,
    cancelled: Number(row.cancelled) || 0,
    failed_payments: Number(row.failed) || 0,
    total_revenue: Number(row.total_revenue) || 0,
    paid_revenue: Number(row.paid_revenue) || 0,
  };
};

const getTotalCount = async (params) => {
  const { clause, params: values } = buildWhereClause(params);
  const rows = await executeQuery(`
    SELECT COUNT(DISTINCT b.id) AS total
    FROM cafe_event_bookings b
    JOIN cafe_events e ON e.id = b.event_id
    JOIN cafe_event_dates d ON d.id = b.event_date_id
    JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
    LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
    LEFT JOIN (${latestCheckinSubquery}) c ON c.booking_id = b.id
    WHERE ${clause}
  `, values);
  return Number(rows[0].total) || 0;
};

const getAdminBookings = async (req, res) => {
  try {
    const params = req.query;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);

    const [rows, total, summary] = await Promise.all([
      getFilteredBookings(params, { page, limit }),
      getTotalCount(params),
      getSummary(params),
    ]);

    const data = rows.map((b) => ({
      id: b.id,
      booking_number: b.booking_number,
      event_id: b.event_id,
      event_title: b.event_title,
      event_slug: b.event_slug,
      event_date: b.event_date,
      start_time: b.start_time,
      end_time: b.end_time,
      door_open_time: b.door_open_time,
      outlet_name: b.outlet_name,
      outlet_address: b.outlet_address,
      outlet_city: b.city,
      customer_name: b.customer_name,
      customer_phone: b.customer_phone,
      customer_email: b.customer_email,
      ticket_name: b.ticket_name,
      quantity: b.quantity,
      ticket_price: Number(b.ticket_price),
      subtotal: Number(b.subtotal),
      tax_amount: Number(b.tax_amount),
      total_amount: Number(b.total_amount),
      payment_status: b.payment_status,
      booking_status: b.booking_status,
      razorpay_payment_id: b.razorpay_payment_id,
      notes: b.notes,
      created_at: b.created_at,
      checked_in: !!b.checked_in_at,
      checked_in_at: b.checked_in_at,
    }));

    res.json({
      success: true,
      data,
      summary,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getAdminBookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAdminBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await executeQuery(`
      SELECT
        b.*,
        e.title AS event_title, e.slug AS event_slug, e.short_description,
        e.event_banner, e.event_thumbnail,
        DATE_FORMAT(d.event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(d.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(d.end_time, '%H:%i') AS end_time,
        TIME_FORMAT(d.door_open_time, '%H:%i') AS door_open_time,
        t.ticket_name,
        o.outlet_name, o.outlet_address, o.city,
        c.id AS checkin_id, c.checked_in_at, c.checked_in_by, c.remarks,
        au.name AS checked_in_by_name
      FROM cafe_event_bookings b
      JOIN cafe_events e ON e.id = b.event_id
      JOIN cafe_event_dates d ON d.id = b.event_date_id
      JOIN cafe_event_ticket_types t ON t.id = b.ticket_type_id
      LEFT JOIN cafe_event_outlets o ON o.id = b.outlet_id
      LEFT JOIN (${latestCheckinSubquery}) c ON c.booking_id = b.id
      LEFT JOIN admin_users au ON au.id = c.checked_in_by
      WHERE b.id = ?
      LIMIT 1
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
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
        booking: {
          id: booking.id,
          booking_number: booking.booking_number,
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          customer_email: booking.customer_email,
          quantity: booking.quantity,
          ticket_price: Number(booking.ticket_price),
          subtotal: Number(booking.subtotal),
          tax_amount: Number(booking.tax_amount),
          total_amount: Number(booking.total_amount),
          payment_status: booking.payment_status,
          booking_status: booking.booking_status,
          razorpay_order_id: booking.razorpay_order_id || null,
          razorpay_payment_id: booking.razorpay_payment_id,
          qr_code: qrCodeDataUrl,
          notes: booking.notes,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
        },
        event: {
          id: booking.event_id,
          title: booking.event_title,
          slug: booking.event_slug,
          short_description: booking.short_description,
          banner: booking.event_banner,
          thumbnail: booking.event_thumbnail,
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
        checkin: booking.checkin_id ? {
          id: booking.checkin_id,
          checked_in_at: booking.checked_in_at,
          checked_in_by: booking.checked_in_by,
          checked_in_by_name: booking.checked_in_by_name,
          remarks: booking.remarks,
        } : null,
      },
    });
  } catch (error) {
    console.error('getAdminBookingById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateBookingStatus = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { booking_status, notes, restore_seats } = req.body;

    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'checked_in', 'no_show'];
    if (!allowedStatuses.includes(booking_status)) {
      return res.status(400).json({ success: false, message: 'Invalid booking status' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [bookings] = await connection.execute(
      'SELECT * FROM cafe_event_bookings WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!bookings.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookings[0];
    const oldStatus = booking.booking_status;

    if (booking_status === 'cancelled' && oldStatus === 'confirmed' && toBool(restore_seats)) {
      await connection.execute(
        'UPDATE cafe_event_dates SET available_seats = available_seats + ? WHERE id = ?',
        [booking.quantity, booking.event_date_id]
      );
      await connection.execute(
        'UPDATE cafe_event_ticket_types SET available_quantity = available_quantity + ? WHERE id = ?',
        [booking.quantity, booking.ticket_type_id]
      );
    }

    const newNotes = notes !== undefined
      ? (booking.notes ? `${booking.notes}\n${notes}` : notes)
      : booking.notes;

    await connection.execute(
      'UPDATE cafe_event_bookings SET booking_status = ?, notes = ? WHERE id = ?',
      [booking_status, newNotes || null, id]
    );

    await connection.commit();
    res.json({ success: true, message: 'Booking status updated' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('updateBookingStatus error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};

const checkInBooking = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const adminId = req.admin?.id;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [bookings] = await connection.execute(
      'SELECT * FROM cafe_event_bookings WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!bookings.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookings[0];

    const [existingCheckins] = await connection.execute(
      'SELECT id FROM cafe_event_checkins WHERE booking_id = ?',
      [id]
    );

    if (existingCheckins.length || booking.booking_status === 'checked_in') {
      const data = {
        id: booking.id,
        booking_number: booking.booking_number,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        customer_email: booking.customer_email,
        booking_status: booking.booking_status,
        payment_status: booking.payment_status,
        checked_in: true,
      };
      await connection.commit();
      return res.json({ success: true, message: 'Customer already checked in', data });
    }

    const invalidBookingStatuses = ['cancelled'];
    const invalidPaymentStatuses = ['failed', 'payment_failed'];
    if (invalidBookingStatuses.includes(booking.booking_status) || invalidPaymentStatuses.includes(booking.payment_status)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot check in this booking because payment is not completed or booking is cancelled',
      });
    }

    const allowedBookingStatuses = ['confirmed', 'paid', 'booked', 'completed'];
    if (!allowedBookingStatuses.includes(booking.booking_status)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Booking must be confirmed, paid, booked, or completed to check in',
      });
    }

    if (booking.payment_status !== 'paid') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot check in this booking because payment is not completed or booking is cancelled',
      });
    }

    await connection.execute(
      'INSERT INTO cafe_event_checkins (booking_id, checked_in_by, remarks) VALUES (?, ?, ?)',
      [id, adminId || null, 'Checked in from admin']
    );

    await connection.commit();

    const data = {
      id: booking.id,
      booking_number: booking.booking_number,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      customer_email: booking.customer_email,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      checked_in: true,
    };

    res.json({ success: true, message: 'Checked in successfully', data });
  } catch (error) {
    if (connection) await connection.rollback();
    if (process.env.NODE_ENV === 'development') {
      console.error('Event check-in error:', error);
    }
    res.status(400).json({
      success: false,
      message: 'Unable to check in booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    if (connection) connection.release();
  }
};

const exportExcel = async (req, res) => {
  try {
    const params = req.query;
    const rows = await getFilteredBookings(params, { paginate: false });
    const summary = await getSummary(params);

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const bookingsSheet = workbook.addWorksheet('Bookings');

    summarySheet.addRow(['Big Bean Café - Event Bookings Report']);
    summarySheet.addRow(['Generated Date', new Date().toLocaleString('en-IN')]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Bookings', summary.total_bookings]);
    summarySheet.addRow(['Confirmed', summary.confirmed]);
    summarySheet.addRow(['Checked In', summary.checked_in]);
    summarySheet.addRow(['Pending', summary.pending]);
    summarySheet.addRow(['Cancelled', summary.cancelled]);
    summarySheet.addRow(['Total Revenue', summary.total_revenue]);
    summarySheet.addRow(['Paid Revenue', summary.paid_revenue]);

    summarySheet.columns = [{ width: 25 }, { width: 25 }];
    summarySheet.getRow(1).font = { size: 14, bold: true };

    bookingsSheet.columns = [
      { header: 'Booking Number', key: 'booking_number', width: 22 },
      { header: 'Event Name', key: 'event_title', width: 25 },
      { header: 'Event Date', key: 'event_date', width: 14 },
      { header: 'Start Time', key: 'start_time', width: 12 },
      { header: 'End Time', key: 'end_time', width: 12 },
      { header: 'Outlet', key: 'outlet_name', width: 20 },
      { header: 'Customer Name', key: 'customer_name', width: 20 },
      { header: 'Phone', key: 'customer_phone', width: 15 },
      { header: 'Email', key: 'customer_email', width: 25 },
      { header: 'Ticket Type', key: 'ticket_name', width: 18 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Total Amount', key: 'total_amount', width: 14 },
      { header: 'Payment Status', key: 'payment_status', width: 15 },
      { header: 'Booking Status', key: 'booking_status', width: 15 },
      { header: 'Razorpay Payment ID', key: 'razorpay_payment_id', width: 22 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Checked In', key: 'checked_in', width: 12 },
      { header: 'Checked In At', key: 'checked_in_at', width: 20 },
    ];

    bookingsSheet.addRows(rows.map((b) => ({
      booking_number: b.booking_number,
      event_title: b.event_title,
      event_date: b.event_date,
      start_time: b.start_time,
      end_time: b.end_time,
      outlet_name: b.outlet_name,
      customer_name: b.customer_name,
      customer_phone: b.customer_phone,
      customer_email: b.customer_email,
      ticket_name: b.ticket_name,
      quantity: b.quantity,
      total_amount: Number(b.total_amount),
      payment_status: b.payment_status,
      booking_status: b.booking_status,
      razorpay_payment_id: b.razorpay_payment_id,
      created_at: b.created_at ? new Date(b.created_at).toLocaleString('en-IN') : '',
      checked_in: b.checked_in_at ? 'Yes' : 'No',
      checked_in_at: b.checked_in_at ? new Date(b.checked_in_at).toLocaleString('en-IN') : '',
    })));

    bookingsSheet.getRow(1).font = { bold: true };
    bookingsSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: bookingsSheet.columns.length } };
    bookingsSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BigBean_Event_Bookings_Report_${date}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('exportExcel error:', error);
    res.status(500).json({ success: false, message: 'Failed to export Excel' });
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const [upcomingEvents] = await executeQuery(`
      SELECT COUNT(DISTINCT e.id) AS count
      FROM cafe_events e
      WHERE e.status = 'active'
        AND EXISTS (
          SELECT 1 FROM cafe_event_dates d
          WHERE d.event_id = e.id AND d.status = 'active' AND d.event_date >= CURDATE()
        )
    `);

    const [todayBookings] = await executeQuery(`
      SELECT COUNT(*) AS count
      FROM cafe_event_bookings
      WHERE DATE(created_at) = CURDATE()
    `);

    const [revenue] = await executeQuery(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM cafe_event_bookings
      WHERE payment_status = 'paid'
    `);

    const [pendingCheckins] = await executeQuery(`
      SELECT COUNT(*) AS count
      FROM cafe_event_bookings b
      WHERE b.booking_status = 'confirmed'
        AND b.payment_status = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM cafe_event_checkins c WHERE c.booking_id = b.id
        )
    `);

    res.json({
      success: true,
      data: {
        upcoming_events: Number(upcomingEvents.count),
        today_bookings: Number(todayBookings.count),
        event_revenue: Number(revenue.total),
        pending_checkins: Number(pendingCheckins.count),
      },
    });
  } catch (error) {
    console.error('getDashboardSummary error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const exportPdf = async (req, res) => {
  try {
    const params = req.query;
    const rows = await getFilteredBookings(params, { paginate: false });
    const summary = await getSummary(params);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const date = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="BigBean_Event_Bookings_Report_${date}.pdf"`);
      res.send(buffer);
    });

    const brown = '#3D1F0D';
    const gold = '#C9943A';

    doc.fontSize(20).fillColor(brown).font('Helvetica-Bold').text('Big Bean Café - Event Bookings Report', 40, 40);
    doc.fontSize(10).fillColor('#666').font('Helvetica').text(`Generated: ${new Date().toLocaleString('en-IN')}`, 40, 70);
    if (params.from_date || params.to_date) {
      doc.text(`Filter Range: ${params.from_date || ''} to ${params.to_date || ''}`, 40, 85);
    }

    const summaryY = 110;
    doc.fontSize(12).fillColor(brown).font('Helvetica-Bold').text('Summary', 40, summaryY);
    doc.fontSize(10).fillColor('#333').font('Helvetica');
    doc.text(`Total Bookings: ${summary.total_bookings}`, 40, summaryY + 20);
    doc.text(`Confirmed: ${summary.confirmed}`, 150, summaryY + 20);
    doc.text(`Checked In: ${summary.checked_in}`, 250, summaryY + 20);
    doc.text(`Pending: ${summary.pending}`, 360, summaryY + 20);
    doc.text(`Cancelled: ${summary.cancelled}`, 450, summaryY + 20);
    doc.text(`Total Revenue: ₹${summary.total_revenue.toFixed(2)}`, 40, summaryY + 35);
    doc.text(`Paid Revenue: ₹${summary.paid_revenue.toFixed(2)}`, 250, summaryY + 35);

    const tableTop = 180;
    const headers = ['Booking #', 'Event', 'Date', 'Customer', 'Phone', 'Ticket', 'Qty', 'Amount', 'Pay', 'Status', 'Check-in'];
    const colWidths = [80, 100, 60, 80, 70, 80, 35, 60, 60, 60, 45];
    const startX = 40;
    const tableWidth = colWidths.reduce((a, w) => a + w, 0);
    let x = startX;

    doc.fontSize(10).fillColor('#fff').font('Helvetica-Bold');
    doc.rect(startX, tableTop, tableWidth, 20).fill(brown);
    headers.forEach((h, i) => {
      doc.text(h, x + 4, tableTop + 5, { width: colWidths[i] - 8 });
      x += colWidths[i];
    });

    doc.fontSize(9).fillColor('#333').font('Helvetica');
    let y = tableTop + 25;
    rows.forEach((b, idx) => {
      if (y > 500) {
        doc.addPage();
        y = 40;
      }
      x = startX;
      const values = [
        b.booking_number,
        b.event_title,
        b.event_date,
        b.customer_name,
        b.customer_phone,
        b.ticket_name,
        String(b.quantity),
        `₹${Number(b.total_amount).toFixed(2)}`,
        b.payment_status,
        b.booking_status,
        b.checked_in_at ? 'Yes' : 'No',
      ];
      if (idx % 2 === 0) {
        doc.rect(startX, y - 4, tableWidth, 18).fill('#f9f9f9');
      }
      doc.fillColor('#333').font('Helvetica').fontSize(9);
      values.forEach((v, i) => {
        doc.text(String(v), x + 4, y, { width: colWidths[i] - 8, height: 14, ellipsis: true });
        x += colWidths[i];
      });
      y += 18;
    });

    doc.end();
  } catch (error) {
    console.error('exportPdf error:', error);
    res.status(500).json({ success: false, message: 'Failed to export PDF' });
  }
};

module.exports = {
  getAdminBookings,
  getAdminBookingById,
  updateBookingStatus,
  checkInBooking,
  getDashboardSummary,
  exportExcel,
  exportPdf,
};
