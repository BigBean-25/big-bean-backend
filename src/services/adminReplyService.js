const { executeQuery } = require('../config/database');

// ── helpers ──────────────────────────────────────────────────────────────────
const toBool = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  const s = String(v || '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

const normalizePhone = (phone = '') => {
  let p = String(phone).replace(/[\s\-().+]/g, '');
  if (p.startsWith('91') && p.length === 12) return p;
  if (p.length === 10) return '91' + p;
  return p;
};

// ── ensure comm log table ─────────────────────────────────────────────────────
let _logTableReady = false;
const ensureLogTable = async () => {
  if (_logTableReady) return;
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS admin_communication_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module_name VARCHAR(100) NOT NULL,
      record_id INT NOT NULL,
      channel ENUM('email','whatsapp','sms','manual') NOT NULL,
      recipient_name VARCHAR(255) NULL,
      recipient_email VARCHAR(255) NULL,
      recipient_phone VARCHAR(50) NULL,
      subject VARCHAR(255) NULL,
      message TEXT NULL,
      status ENUM('sent','failed','opened','copied','pending') DEFAULT 'sent',
      provider VARCHAR(100) NULL,
      error_message TEXT NULL,
      sent_by INT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  _logTableReady = true;
};

// ── log communication ────────────────────────────────────────────────────────
const logCommunication = async ({
  moduleName, recordId, channel,
  recipientName, recipientEmail, recipientPhone,
  subject, message, status = 'sent',
  provider = null, errorMessage = null, sentBy = null,
}) => {
  try {
    await ensureLogTable();
    await executeQuery(
      `INSERT INTO admin_communication_logs
        (module_name, record_id, channel, recipient_name, recipient_email,
         recipient_phone, subject, message, status, provider, error_message, sent_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [moduleName, recordId, channel, recipientName || null, recipientEmail || null,
       recipientPhone || null, subject || null, message || null, status,
       provider || null, errorMessage || null, sentBy || null]
    );
  } catch (e) {
    console.warn('logCommunication warn:', e.message);
  }
};

// ── get logs for a record ────────────────────────────────────────────────────
const getLogs = async (moduleName, recordId) => {
  await ensureLogTable();
  return executeQuery(
    'SELECT * FROM admin_communication_logs WHERE module_name=? AND record_id=? ORDER BY sent_at DESC',
    [moduleName, recordId]
  ).catch(() => []);
};

// ── send email reply ─────────────────────────────────────────────────────────
const sendAdminEmailReply = async ({
  moduleName, recordId, to, name, subject, message, adminId = null,
}) => {
  if (!to) {
    await logCommunication({ moduleName, recordId, channel: 'email', recipientName: name, recipientEmail: to, subject, message, status: 'failed', errorMessage: 'Email address is missing.' });
    return { success: false, message: 'Email address is missing.' };
  }

  // Pre-check SMTP
  let cfg = {};
  try {
    const rows = await executeQuery(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?,?,?,?,?,?)`,
      ['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'mail_from_email']
    );
    rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
  } catch (e) {
    console.warn('SMTP settings fetch warn:', e.message);
  }

  if (!toBool(cfg.smtp_enabled)) {
    await logCommunication({ moduleName, recordId, channel: 'email', recipientName: name, recipientEmail: to, subject, message, status: 'failed', errorMessage: 'SMTP not enabled', sentBy: adminId });
    return { success: false, message: 'SMTP is not enabled. Please configure Email / SMTP in Settings.' };
  }
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_password) {
    await logCommunication({ moduleName, recordId, channel: 'email', recipientName: name, recipientEmail: to, subject, message, status: 'failed', errorMessage: 'SMTP not configured', sentBy: adminId });
    return { success: false, message: 'SMTP configuration is incomplete. Please check Settings.' };
  }

  try {
    const nodemailer = require('nodemailer');
    const settingRows = await executeQuery(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?,?,?,?)`,
      ['mail_from_name', 'mail_from_email', 'smtp_secure', 'smtp_port']
    );
    settingRows.forEach(r => { cfg[r.setting_key] = r.setting_value; });

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port) || 587,
      secure: toBool(cfg.smtp_secure),
      auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
    });

    const html = buildHtml(name, subject, message);
    await transporter.sendMail({
      from: `"${cfg.mail_from_name || 'Big Bean Café'}" <${cfg.mail_from_email || cfg.smtp_user}>`,
      to,
      subject,
      html,
    });

    await logCommunication({ moduleName, recordId, channel: 'email', recipientName: name, recipientEmail: to, subject, message, status: 'sent', provider: 'smtp', sentBy: adminId });
    return { success: true, message: `Email sent successfully to ${to}` };
  } catch (e) {
    console.error('sendAdminEmailReply error:', e.message);
    await logCommunication({ moduleName, recordId, channel: 'email', recipientName: name, recipientEmail: to, subject, message, status: 'failed', errorMessage: e.message, sentBy: adminId });
    return { success: false, message: `Email could not be sent. ${e.message}` };
  }
};

// ── send WhatsApp reply ──────────────────────────────────────────────────────
const sendAdminWhatsAppReply = async ({
  moduleName, recordId, phone, name, message, adminId = null,
}) => {
  if (!phone) {
    await logCommunication({ moduleName, recordId, channel: 'whatsapp', recipientName: name, recipientPhone: phone, message, status: 'failed', errorMessage: 'Phone number is missing.' });
    return { success: false, message: 'Phone number is missing.' };
  }

  // Check WhatsApp API settings
  let cfg = {};
  try {
    const rows = await executeQuery(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?,?,?)`,
      ['whatsapp_enabled', 'whatsapp_api_key', 'whatsapp_business_number']
    );
    rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
  } catch (e) {
    console.warn('WA settings fetch warn:', e.message);
  }

  const normalized = normalizePhone(phone);
  const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;

  // If API key present, could call API — for now always return wa.me fallback
  await logCommunication({ moduleName, recordId, channel: 'whatsapp', recipientName: name, recipientPhone: phone, message, status: 'sent', provider: 'whatsapp_web', sentBy: adminId });
  return { success: true, whatsapp_web_url: waUrl, message: 'Open WhatsApp Web link' };
};

// ── log copied message ────────────────────────────────────────────────────────
const logCopied = async ({ moduleName, recordId, name, phone, message, adminId = null }) => {
  await logCommunication({ moduleName, recordId, channel: 'manual', recipientName: name, recipientPhone: phone, message, status: 'copied', sentBy: adminId });
  return { success: true };
};

// ── HTML builder ─────────────────────────────────────────────────────────────
const buildHtml = (name, subject, message) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f7f3ee;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6c7a8;">
    <div style="background:linear-gradient(135deg,#120905,#3D1F0D);padding:28px 32px;">
      <h1 style="margin:0;color:#C9943A;font-size:22px;letter-spacing:1px;">Big Bean Café</h1>
      <p style="margin:4px 0 0;color:#e6c7a8;font-size:13px;">${subject}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#3d1f0d;font-size:15px;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
      <div style="color:#6b3520;font-size:14px;line-height:1.7;white-space:pre-line;">${message}</div>
    </div>
    <div style="background:#fff7ed;padding:16px 32px;border-top:1px solid #e6c7a8;text-align:center;">
      <p style="margin:0;color:#9b6b50;font-size:11px;">Big Bean Café Coffee Roasters — Bengaluru, Karnataka</p>
    </div>
  </div>
</body>
</html>`;

module.exports = { sendAdminEmailReply, sendAdminWhatsAppReply, logCommunication, logCopied, getLogs, ensureLogTable, normalizePhone };
