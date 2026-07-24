const { executeQuery } = require('../config/database');
const { sendCustomEmail } = require('../services/mailService');

let tableEnsured = false;
const ensureEventMessageTemplatesTable = async () => {
  if (tableEnsured) return;
  tableEnsured = true;
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS event_message_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_key VARCHAR(100) UNIQUE NOT NULL,
        template_name VARCHAR(150) NOT NULL,
        subject VARCHAR(255) NULL,
        email_body TEXT NULL,
        whatsapp_body TEXT NULL,
        status ENUM('active','inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    console.error('ensureEventMessageTemplatesTable error:', error.message);
  }
};

const seedTemplates = async () => {
  try {
    const countRows = await executeQuery('SELECT COUNT(*) AS cnt FROM event_message_templates');
    const cnt = countRows[0]?.cnt ?? 0;
    if (cnt > 0) return;
    const templates = [
      {
        key: 'booking_confirmation',
        name: 'Booking Confirmation',
        subject: 'Your Big Bean Café Event Booking is Confirmed',
        email_body: '<p>Hi {{customer_name}},</p><p>Your booking for <strong>{{event_title}}</strong> is confirmed.</p><p>Booking ID: {{booking_id}}<br>Date: {{event_date}}<br>Time: {{event_time}}<br>Venue: {{venue}}<br>Tickets: {{quantity}}</p><p>Please show this email at check-in.</p><p>Thank you,<br>Big Bean Café</p>',
        whatsapp_body: 'Hi {{customer_name}}, your booking for {{event_title}} is confirmed.\n\nBooking ID: {{booking_id}}\nDate: {{event_date}}\nTime: {{event_time}}\nVenue: {{venue}}\nTickets: {{quantity}}\n\nPlease show this message at check-in.\n\nThank you,\nBig Bean Café',
      },
      {
        key: 'booking_reminder',
        name: 'Booking Reminder',
        subject: 'Reminder: Your Big Bean Café Event is Coming Up',
        email_body: '<p>Hi {{customer_name}},</p><p>This is a reminder that your booking for <strong>{{event_title}}</strong> is coming up.</p><p>Booking ID: {{booking_id}}<br>Date: {{event_date}}<br>Time: {{event_time}}<br>Venue: {{venue}}<br>Tickets: {{quantity}}</p><p>We look forward to seeing you!</p><p>Thank you,<br>Big Bean Café</p>',
        whatsapp_body: 'Hi {{customer_name}}, reminder: your booking for {{event_title}} is coming up.\n\nBooking ID: {{booking_id}}\nDate: {{event_date}}\nTime: {{event_time}}\nVenue: {{venue}}\nTickets: {{quantity}}\n\nWe look forward to seeing you!\n\nThank you,\nBig Bean Café',
      },
      {
        key: 'checkin_success',
        name: 'Check-in Success',
        subject: 'You are checked in - Big Bean Café Event',
        email_body: '<p>Hi {{customer_name}},</p><p>You are checked in for <strong>{{event_title}}</strong>. Enjoy your Big Bean Café event!</p><p>Booking ID: {{booking_id}}<br>Date: {{event_date}}<br>Time: {{event_time}}<br>Venue: {{venue}}<br>Tickets: {{quantity}}</p>',
        whatsapp_body: 'Hi {{customer_name}}, you are checked in for {{event_title}}. Enjoy your Big Bean Café event!',
      },
      {
        key: 'booking_cancelled',
        name: 'Booking Cancelled',
        subject: 'Your Big Bean Café Event Booking is Cancelled',
        email_body: '<p>Hi {{customer_name}},</p><p>Your booking for <strong>{{event_title}}</strong> has been cancelled.</p><p>Booking ID: {{booking_id}}<br>Date: {{event_date}}<br>Time: {{event_time}}<br>Venue: {{venue}}<br>Tickets: {{quantity}}</p><p>If you have any questions, please contact us.</p><p>Thank you,<br>Big Bean Café</p>',
        whatsapp_body: 'Hi {{customer_name}}, your booking for {{event_title}} has been cancelled.\n\nBooking ID: {{booking_id}}\nDate: {{event_date}}\nTime: {{event_time}}\nVenue: {{venue}}\nTickets: {{quantity}}\n\nIf you have any questions, please contact us.\n\nThank you,\nBig Bean Café',
      },
    ];
    for (const t of templates) {
      await executeQuery(
        'INSERT IGNORE INTO event_message_templates (template_key, template_name, subject, email_body, whatsapp_body, status) VALUES (?, ?, ?, ?, ?, ?)',
        [t.key, t.name, t.subject, t.email_body, t.whatsapp_body, 'active']
      );
    }
    console.log('Seeded event_message_templates');
  } catch (error) {
    console.error('seedTemplates error:', error.message);
  }
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

const getBookingForMessage = async (id) => {
  const rows = await executeQuery(`
    SELECT
      b.id, b.booking_number, b.customer_name, b.customer_email, b.customer_phone,
      b.quantity, b.total_amount, b.payment_status, b.booking_status,
      e.title AS event_title,
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
    WHERE b.id = ?
    LIMIT 1
  `, [id]);
  return rows[0] || null;
};

const renderMessage = (template, booking, customMessage = '') => {
  const venue = [booking.outlet_name, booking.outlet_address, booking.city].filter(Boolean).join(', ');
  const eventTime = booking.start_time
    ? `${formatTime(booking.start_time)}${booking.end_time ? ` - ${formatTime(booking.end_time)}` : ''}`
    : '';
  const values = {
    customer_name: booking.customer_name || '',
    event_title: booking.event_title || '',
    booking_id: booking.booking_number || String(booking.id),
    event_date: formatDate(booking.event_date),
    event_time: eventTime,
    venue,
    quantity: String(booking.quantity || 1),
    amount: `₹${Number(booking.total_amount || 0).toFixed(2)}`,
    status: booking.booking_status || '',
  };

  let emailBody = customMessage || template.email_body || '';
  let whatsappBody = customMessage || template.whatsapp_body || '';

  Object.entries(values).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    emailBody = emailBody.replace(regex, value);
    whatsappBody = whatsappBody.replace(regex, value);
  });

  const subject = (template.subject || '').replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || '');

  return { subject, emailBody, whatsappBody };
};

const getTemplates = async (req, res) => {
  try {
    await ensureEventMessageTemplatesTable();
    await seedTemplates();
    const rows = await executeQuery(
      'SELECT id, template_key, template_name, subject, email_body, whatsapp_body, status, created_at, updated_at FROM event_message_templates ORDER BY id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('getTemplates error:', error);
    res.status(500).json({ success: false, message: 'Unable to load message templates' });
  }
};

const getTemplateByKey = async (req, res) => {
  try {
    await ensureEventMessageTemplatesTable();
    await seedTemplates();
    const { templateKey } = req.params;
    const rows = await executeQuery(
      'SELECT id, template_key, template_name, subject, email_body, whatsapp_body, status, created_at, updated_at FROM event_message_templates WHERE template_key = ? LIMIT 1',
      [templateKey]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('getTemplateByKey error:', error);
    res.status(500).json({ success: false, message: 'Unable to load template' });
  }
};

const updateTemplate = async (req, res) => {
  try {
    await ensureEventMessageTemplatesTable();
    const { templateKey } = req.params;
    const { template_name, subject, email_body, whatsapp_body, status } = req.body;
    if (!template_name) return res.status(400).json({ success: false, message: 'Template name is required' });

    const [existing] = await executeQuery('SELECT id FROM event_message_templates WHERE template_key = ?', [templateKey]);
    if (!existing) return res.status(404).json({ success: false, message: 'Template not found' });

    await executeQuery(
      'UPDATE event_message_templates SET template_name = ?, subject = ?, email_body = ?, whatsapp_body = ?, status = ? WHERE template_key = ?',
      [
        template_name,
        subject || null,
        email_body || null,
        whatsapp_body || null,
        status === 'inactive' ? 'inactive' : 'active',
        templateKey,
      ]
    );

    res.json({ success: true, message: 'Template updated successfully' });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('updateTemplate error:', error);
    res.status(500).json({ success: false, message: 'Unable to update template' });
  }
};

const sendEventEmail = async (req, res) => {
  try {
    await ensureEventMessageTemplatesTable();
    await seedTemplates();
    const { id } = req.params;
    const { template_key, custom_message } = req.body || {};

    const booking = await getBookingForMessage(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.customer_email) return res.status(400).json({ success: false, message: 'Customer email is missing' });

    let template = { subject: '', email_body: '' };
    if (template_key) {
      const rows = await executeQuery('SELECT * FROM event_message_templates WHERE template_key = ? AND status = ? LIMIT 1', [template_key, 'active']);
      if (rows.length) template = rows[0];
    }

    const { subject, emailBody } = renderMessage(template, booking, custom_message);
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f7f3ee;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6c7a8;">
    <div style="background:linear-gradient(135deg,#120905,#3D1F0D);padding:28px 32px;">
      <h1 style="margin:0;color:#C9943A;font-size:22px;letter-spacing:1px;">Big Bean Café</h1>
    </div>
    <div style="padding:28px 32px;">${emailBody}</div>
    <div style="background:#fff7ed;padding:16px 32px;border-top:1px solid #e6c7a8;text-align:center;">
      <p style="margin:0;color:#9b6b50;font-size:11px;">Big Bean Café Coffee Roasters — Bengaluru, Karnataka</p>
    </div>
  </div>
</body></html>`;

    const result = await sendCustomEmail({
      to: booking.customer_email,
      subject,
      html,
      module_name: 'event_booking',
      record_id: booking.id,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.reason || 'Email service is not configured' });
    }

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('sendEventEmail error:', error);
    res.status(500).json({ success: false, message: 'Unable to send email' });
  }
};

const sendEventWhatsApp = async (req, res) => {
  try {
    await ensureEventMessageTemplatesTable();
    await seedTemplates();
    const { id } = req.params;
    const { template_key, custom_message } = req.body || {};

    const booking = await getBookingForMessage(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.customer_phone) return res.status(400).json({ success: false, message: 'Customer phone is missing' });

    let template = { whatsapp_body: '' };
    if (template_key) {
      const rows = await executeQuery('SELECT * FROM event_message_templates WHERE template_key = ? AND status = ? LIMIT 1', [template_key, 'active']);
      if (rows.length) template = rows[0];
    }

    const { whatsappBody } = renderMessage(template, booking, custom_message);

    const enabled = String(process.env.WHATSAPP_ENABLED || '').toLowerCase() === 'true';
    if (enabled && process.env.WHATSAPP_API_URL) {
      // Optional real API integration
      try {
        const response = await fetch(process.env.WHATSAPP_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.WHATSAPP_API_TOKEN ? { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` } : {}),
          },
          body: JSON.stringify({ to: booking.customer_phone, message: whatsappBody }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'WhatsApp API failed');
        return res.json({ success: true, message: 'WhatsApp message sent', mode: 'api' });
      } catch (apiError) {
        if (process.env.NODE_ENV === 'development') console.error('WhatsApp API error:', apiError);
      }
    }

    // Manual fallback: generate wa.me link
    const digits = String(booking.customer_phone).replace(/\D/g, '');
    const phone = digits.startsWith('91') ? digits : `91${digits}`;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappBody)}`;

    res.json({
      success: true,
      mode: 'manual',
      whatsapp_url: whatsappUrl,
      message: 'WhatsApp message ready to send manually',
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('sendEventWhatsApp error:', error);
    res.status(500).json({ success: false, message: 'Unable to prepare WhatsApp message' });
  }
};

module.exports = {
  getTemplates,
  getTemplateByKey,
  updateTemplate,
  sendEventEmail,
  sendEventWhatsApp,
};
