const { executeQuery } = require('../config/database');

const getSettings = async (keys) => {
  const rows = await executeQuery(
    `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
    keys
  );
  const map = {};
  rows.forEach(r => { map[r.setting_key] = r.setting_value; });
  return map;
};

// Generate WhatsApp message text for a given status
const generateOrderMessage = (order, status = 'received') => {
  const name   = order.customer_name || 'Customer';
  const num    = order.order_number  || '';
  const amt    = `₹${Number(order.total_amount || 0).toFixed(0)}`;
  const payId  = order.payment_id    || '';

  const map = {
    received: `Hi ${name}, your Big Bean Café order *${num}* has been received.\n\nPayment Status: ${order.payment_method === 'online' || order.payment_method === 'Online Payment' ? 'Paid ✅' : 'COD Pending'}\nTotal: ${amt}\n\nOur team will confirm shortly. Thank you! ☕`,
    payment_confirmed: `Hi ${name}, payment for your Big Bean Café order *${num}* is successful. ✅\n\nPayment ID: ${payId}\nTotal Paid: ${amt}\n\nWe will update you once your order is ready.`,
    confirmed: `Hi ${name}, your Big Bean Café order *${num}* has been confirmed by our team. ✅`,
    packing:   `Hi ${name}, your Big Bean Café order *${num}* is being packed. 📦`,
    ready:     `Hi ${name}, your Big Bean Café order *${num}* is ready! 🎉 Our team will contact you for pickup/delivery details.`,
    delivered: `Hi ${name}, your Big Bean Café order *${num}* has been delivered. Thank you for ordering with us! ☕`,
    cancelled: `Hi ${name}, your Big Bean Café order *${num}* has been cancelled. Please contact support if you need assistance.`,
  };

  return map[status] || `Hi ${name}, your Big Bean Café order *${num}* status has been updated to: ${status}.`;
};

// Send WhatsApp — returns web URL fallback if API not configured
const sendWhatsApp = async (order, status = 'received') => {
  try {
    const cfg = await getSettings([
      'whatsapp_enabled', 'whatsapp_provider', 'whatsapp_api_key', 'whatsapp_business_number',
    ]);

    if (cfg.whatsapp_enabled !== '1') {
      return { success: false, reason: 'WhatsApp not enabled' };
    }

    const message = generateOrderMessage(order, status);
    const phone   = (order.customer_phone || '').replace(/\D/g, '');

    // If no API key, return WhatsApp Web fallback URL
    if (!cfg.whatsapp_api_key || !cfg.whatsapp_provider) {
      const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
      return { success: false, fallback: true, whatsapp_web_url: waUrl, message };
    }

    // Future: add provider-specific API calls here (e.g. Gupshup, WATI, etc.)
    // For now return fallback
    const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
    return { success: false, fallback: true, whatsapp_web_url: waUrl, message };
  } catch (e) {
    console.error('sendWhatsApp error:', e.message);
    return { success: false, reason: e.message };
  }
};

module.exports = { sendWhatsApp, generateOrderMessage };
