const { executeQuery } = require('../config/database');

const toBool = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  const s = String(v || '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
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

// Build order confirmation HTML
const buildOrderEmailHtml = (order, status = 'received') => {
  const statusLine = status === 'received'
    ? (order.payment_method === 'online' || order.payment_method === 'Online Payment'
        ? '<strong style="color:#16a34a">Paid</strong>'
        : '<strong style="color:#b45309">COD Pending</strong>')
    : `<strong>${status}</strong>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f7f3ee;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6c7a8;">
    <div style="background:linear-gradient(135deg,#120905,#3D1F0D);padding:28px 32px;">
      <h1 style="margin:0;color:#C9943A;font-size:22px;letter-spacing:1px;">Big Bean Café</h1>
      <p style="margin:4px 0 0;color:#e6c7a8;font-size:13px;">Order Notification</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#3d1f0d;font-size:15px;margin:0 0 16px;">Hi <strong>${order.customer_name}</strong>,</p>
      <p style="color:#6b3520;font-size:14px;margin:0 0 20px;">${getStatusMessage(status)}</p>
      <div style="background:#fff7ed;border:1px solid #e6c7a8;border-radius:12px;padding:20px;margin:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Order Number</td><td style="color:#3d1f0d;font-weight:bold;text-align:right;">${order.order_number}</td></tr>
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Payment Status</td><td style="text-align:right;">${statusLine}</td></tr>
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Total Amount</td><td style="color:#3d1f0d;font-weight:bold;text-align:right;">₹${Number(order.total_amount).toFixed(2)}</td></tr>
          ${order.payment_id ? `<tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Payment ID</td><td style="color:#3d1f0d;font-size:12px;text-align:right;">${order.payment_id}</td></tr>` : ''}
        </table>
      </div>
      <p style="color:#6b3520;font-size:13px;">Our team will update you on your order shortly.</p>
      <p style="color:#9b6b50;font-size:12px;margin-top:24px;">Thank you for choosing Big Bean Café ☕</p>
    </div>
    <div style="background:#fff7ed;padding:16px 32px;border-top:1px solid #e6c7a8;text-align:center;">
      <p style="margin:0;color:#9b6b50;font-size:11px;">Big Bean Café Coffee Roasters — Bengaluru, Karnataka</p>
    </div>
  </div>
</body>
</html>`;
};

const getStatusMessage = (status) => {
  const map = {
    received:           'Thank you for your order from Big Bean Café! We have received your order and will confirm shortly.',
    payment_confirmed:  'Your payment has been confirmed. We are preparing your order.',
    confirmed:          'Your Big Bean Café order has been confirmed by our team.',
    packing:            'Your Big Bean Café order is being packed and will be ready soon.',
    ready:              'Your Big Bean Café order is ready! Our team will share pickup/delivery details shortly.',
    delivered:          'Your Big Bean Café order has been delivered. Thank you for ordering with us!',
    cancelled:          'Your Big Bean Café order has been cancelled. Please contact support if you need assistance.',
  };
  return map[status] || `Your order status has been updated to: ${status}.`;
};

const getStatusSubject = (orderNumber, status) => {
  const map = {
    received:          `Your Big Bean Café Order is Confirmed - ${orderNumber}`,
    payment_confirmed: `Payment Confirmed for Your Big Bean Café Order - ${orderNumber}`,
    confirmed:         `Your Big Bean Café Order has been Confirmed - ${orderNumber}`,
    packing:           `Your Big Bean Café Order is Being Packed - ${orderNumber}`,
    ready:             `Your Big Bean Café Order is Ready - ${orderNumber}`,
    delivered:         `Your Big Bean Café Order has been Delivered - ${orderNumber}`,
    cancelled:         `Your Big Bean Café Order has been Cancelled - ${orderNumber}`,
  };
  return map[status] || `Big Bean Café Order Update - ${orderNumber}`;
};

const logEmail = async ({ module_name, record_id, recipient_email, subject, status, error_message }) => {
  try {
    await executeQuery(
      'INSERT INTO email_logs (module_name, record_id, recipient_email, subject, status, error_message) VALUES (?,?,?,?,?,?)',
      [module_name || 'order', record_id || null, recipient_email, subject, status, error_message || null]
    );
  } catch {}
};

// Send email using nodemailer + site_settings SMTP
const sendOrderEmail = async (order, status = 'received', toOverride = null) => {
  const to = toOverride || order.customer_email;
  const subject = getStatusSubject(order.order_number, status);
  try {
    const cfg = await getSettings([
      'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure',
      'smtp_user', 'smtp_password', 'mail_from_name', 'mail_from_email',
    ]);

    if (!toBool(cfg.smtp_enabled)) {
      await logEmail({ module_name: 'order', record_id: order.id, recipient_email: to || '', subject, status: 'failed', error_message: 'SMTP not enabled' });
      return { success: false, reason: 'SMTP is not enabled. Please configure Email / SMTP in Settings.' };
    }
    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_password) {
      await logEmail({ module_name: 'order', record_id: order.id, recipient_email: to || '', subject, status: 'failed', error_message: 'SMTP not configured' });
      return { success: false, reason: 'SMTP configuration is incomplete. Please check host, username and password in Settings.' };
    }
    if (!to) {
      await logEmail({ module_name: 'order', record_id: order.id, recipient_email: '', subject, status: 'failed', error_message: 'No recipient email' });
      return { success: false, reason: 'Customer email is missing for this record.' };
    }

    const nodemailer = require('nodemailer');
    const port = parseInt(cfg.smtp_port) || 587;
    const secure = toBool(cfg.smtp_secure);
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port,
      secure,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
    });

    const html = buildOrderEmailHtml(order, status);
    await transporter.sendMail({
      from: `"${cfg.mail_from_name || 'Big Bean Café'}" <${cfg.mail_from_email || cfg.smtp_user}>`,
      to,
      subject,
      html,
    });

    await logEmail({ module_name: 'order', record_id: order.id, recipient_email: to, subject, status: 'sent' });
    return { success: true };
  } catch (e) {
    console.error('sendOrderEmail error:', e.message);
    await logEmail({ module_name: 'order', record_id: order.id, recipient_email: to || '', subject, status: 'failed', error_message: e.message });
    // Friendly error messages
    const msg = e.message || '';
    if (msg.includes('Invalid login') || msg.includes('535') || msg.includes('auth')) {
      return { success: false, reason: 'SMTP login failed. For Gmail, use an App Password — not your normal password.' };
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
      return { success: false, reason: 'SMTP connection failed. Please check host and port in Settings.' };
    }
    return { success: false, reason: e.message };
  }
};

// Send a custom email using configured SMTP
const sendCustomEmail = async ({ to, subject, html, module_name = 'general', record_id = null }) => {
  try {
    const cfg = await getSettings([
      'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure',
      'smtp_user', 'smtp_password', 'mail_from_name', 'mail_from_email',
    ]);

    if (!toBool(cfg.smtp_enabled)) {
      await logEmail({ module_name, record_id, recipient_email: to || '', subject, status: 'failed', error_message: 'SMTP not enabled' });
      return { success: false, reason: 'Email service is not configured' };
    }
    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_password) {
      await logEmail({ module_name, record_id, recipient_email: to || '', subject, status: 'failed', error_message: 'SMTP not configured' });
      return { success: false, reason: 'Email service is not configured' };
    }
    if (!to) {
      await logEmail({ module_name, record_id, recipient_email: '', subject, status: 'failed', error_message: 'No recipient email' });
      return { success: false, reason: 'Customer email is missing' };
    }

    const nodemailer = require('nodemailer');
    const port = parseInt(cfg.smtp_port) || 587;
    const secure = toBool(cfg.smtp_secure);
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port,
      secure,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
    });

    await transporter.sendMail({
      from: `"${cfg.mail_from_name || 'Big Bean Café'}" <${cfg.mail_from_email || cfg.smtp_user}>`,
      to,
      subject,
      html,
    });

    await logEmail({ module_name, record_id, recipient_email: to, subject, status: 'sent' });
    return { success: true };
  } catch (e) {
    console.error('sendCustomEmail error:', e.message);
    await logEmail({ module_name, record_id, recipient_email: to || '', subject, status: 'failed', error_message: e.message });
    const msg = e.message || '';
    if (msg.includes('Invalid login') || msg.includes('535') || msg.includes('auth')) {
      return { success: false, reason: 'SMTP login failed. For Gmail, use an App Password.' };
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
      return { success: false, reason: 'SMTP connection failed. Please check host and port.' };
    }
    return { success: false, reason: e.message };
  }
};

// Send admin notification
const sendAdminOrderNotification = async (order) => {
  try {
    const cfg = await getSettings(['smtp_enabled', 'admin_notification_email']);
    if (!toBool(cfg.smtp_enabled) || !cfg.admin_notification_email) return;
    await sendOrderEmail(order, 'received', cfg.admin_notification_email);
  } catch (e) {
    console.error('sendAdminOrderNotification error:', e.message);
  }
};

const buildEventTicketEmailHtml = (booking, frontEndUrl) => {
  const successUrl = `${frontEndUrl}/events/booking-success/${booking.booking_number}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f7f3ee;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6c7a8;">
    <div style="background:linear-gradient(135deg,#120905,#3D1F0D);padding:28px 32px;">
      <h1 style="margin:0;color:#C9943A;font-size:22px;letter-spacing:1px;">Big Bean Café</h1>
      <p style="margin:4px 0 0;color:#e6c7a8;font-size:13px;">Event Ticket Confirmed</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#3d1f0d;font-size:15px;margin:0 0 16px;">Hi <strong>${booking.customer_name}</strong>,</p>
      <p style="color:#6b3520;font-size:14px;margin:0 0 20px;">Your event ticket has been confirmed.</p>
      <div style="background:#fff7ed;border:1px solid #e6c7a8;border-radius:12px;padding:20px;margin:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Booking Number</td><td style="color:#3d1f0d;font-weight:bold;text-align:right;">${booking.booking_number}</td></tr>
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Event</td><td style="color:#3d1f0d;text-align:right;">${booking.event_title}</td></tr>
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Date & Time</td><td style="color:#3d1f0d;text-align:right;">${booking.event_date}, ${booking.start_time} - ${booking.end_time}</td></tr>
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Outlet</td><td style="color:#3d1f0d;text-align:right;">${booking.outlet_name || ''}<br/>${booking.outlet_address || ''}</td></tr>
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Ticket</td><td style="color:#3d1f0d;text-align:right;">${booking.ticket_name} x ${booking.quantity}</td></tr>
          <tr><td style="color:#9b6b50;font-size:12px;padding:4px 0;">Total Paid</td><td style="color:#3d1f0d;font-weight:bold;text-align:right;">₹${Number(booking.total_amount).toFixed(2)}</td></tr>
        </table>
      </div>
      <p style="color:#6b3520;font-size:13px;">Please show the ticket QR code at the event entry.</p>
      <p style="color:#6b3520;font-size:13px;">Download ticket: <a href="${successUrl}" style="color:#C9943A;">${successUrl}</a></p>
      <p style="color:#9b6b50;font-size:12px;margin-top:24px;">Regards,<br/>Big Bean Café</p>
    </div>
    <div style="background:#fff7ed;padding:16px 32px;border-top:1px solid #e6c7a8;text-align:center;">
      <p style="margin:0;color:#9b6b50;font-size:11px;">Big Bean Café Coffee Roasters — Bengaluru, Karnataka</p>
    </div>
  </div>
</body>
</html>`;
};

const sendEventTicketEmail = async (booking) => {
  const to = booking.customer_email;
  const subject = 'Your Big Bean Cafe Event Ticket is Confirmed';
  try {
    const cfg = await getSettings([
      'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure',
      'smtp_user', 'smtp_password', 'mail_from_name', 'mail_from_email',
      'frontend_url',
    ]);

    if (!toBool(cfg.smtp_enabled)) {
      await logEmail({ module_name: 'event_booking', record_id: booking.id, recipient_email: to || '', subject, status: 'failed', error_message: 'SMTP not enabled' });
      return { success: false, reason: 'SMTP is not enabled.' };
    }
    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_password) {
      await logEmail({ module_name: 'event_booking', record_id: booking.id, recipient_email: to || '', subject, status: 'failed', error_message: 'SMTP not configured' });
      return { success: false, reason: 'SMTP configuration is incomplete.' };
    }
    if (!to) {
      await logEmail({ module_name: 'event_booking', record_id: booking.id, recipient_email: '', subject, status: 'failed', error_message: 'No recipient email' });
      return { success: false, reason: 'Customer email is missing.' };
    }

    const nodemailer = require('nodemailer');
    const port = parseInt(cfg.smtp_port) || 587;
    const secure = toBool(cfg.smtp_secure);
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port,
      secure,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
    });

    const frontEndUrl = cfg.frontend_url || process.env.FRONTEND_URL || 'https://bigbeancafe.in';
    const html = buildEventTicketEmailHtml(booking, frontEndUrl);
    await transporter.sendMail({
      from: `"${cfg.mail_from_name || 'Big Bean Café'}" <${cfg.mail_from_email || cfg.smtp_user}>`,
      to,
      subject,
      html,
    });

    await logEmail({ module_name: 'event_booking', record_id: booking.id, recipient_email: to, subject, status: 'sent' });
    return { success: true };
  } catch (e) {
    console.error('sendEventTicketEmail error:', e.message);
    await logEmail({ module_name: 'event_booking', record_id: booking.id, recipient_email: to || '', subject, status: 'failed', error_message: e.message });
    return { success: false, reason: e.message };
  }
};

module.exports = { sendOrderEmail, sendAdminOrderNotification, sendEventTicketEmail, sendCustomEmail, getStatusMessage };
