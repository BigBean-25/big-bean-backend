const crypto = require('crypto');
const { executeQuery } = require('../config/database');
const { createAdminNotification } = require('../services/adminNotificationService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSetting = async (key) => {
  const rows = await executeQuery(
    'SELECT setting_value FROM site_settings WHERE setting_key = ?', [key]
  );
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

// Safe column migration — SHOW COLUMNS first, no IF NOT EXISTS
const ensurePaymentColumns = async () => {
  const cols = await executeQuery('SHOW COLUMNS FROM merchandise_orders');
  const existing = new Set(cols.map(c => c.Field));
  const toAdd = [
    ['payment_provider',  'VARCHAR(50) NULL'],
    ['payment_status',    "VARCHAR(50) DEFAULT 'pending'"],
    ['payment_order_id',  'VARCHAR(255) NULL'],
    ['payment_id',        'VARCHAR(255) NULL'],
    ['payment_signature', 'TEXT NULL'],
    ['paid_at',           'DATETIME NULL'],
  ];
  for (const [col, def] of toAdd) {
    if (!existing.has(col)) {
      await executeQuery(`ALTER TABLE merchandise_orders ADD COLUMN ${col} ${def}`);
    }
  }
};

let colsEnsured = false;
const ensureColsOnce = async () => {
  if (colsEnsured) return;
  colsEnsured = true;
  await ensurePaymentColumns();
};

// ─── GET /api/payments/validate-config ─────────────────────────────────────────

const validateConfig = async (req, res) => {
  try {
    const cfg = await getSettings([
      'payment_enabled', 'online_payment_enabled',
      'razorpay_key_id', 'razorpay_key_secret', 'payment_provider', 'currency'
    ]);

    if (cfg.payment_enabled !== '1') {
      return res.json({ success: false, message: 'Payments are currently disabled.' });
    }
    if (cfg.online_payment_enabled !== '1') {
      return res.json({ success: false, message: 'Online payment is not enabled.' });
    }
    if (!cfg.razorpay_key_id) {
      return res.json({ success: false, message: 'Razorpay Key ID is missing. Please configure Payment Gateway settings.' });
    }
    if (!cfg.razorpay_key_secret || cfg.razorpay_key_secret === '********' || cfg.razorpay_key_secret.trim() === '') {
      return res.json({ success: false, message: 'Razorpay Key Secret is missing. Please configure Payment Gateway settings.' });
    }
    if (cfg.payment_provider !== 'razorpay') {
      return res.json({ success: false, message: 'Only Razorpay is currently supported as payment provider.' });
    }

    res.json({ success: true, can_accept_online_payment: true });
  } catch (e) {
    console.error('validateConfig error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /api/payments/public-config ─────────────────────────────────────────

const getPublicConfig = async (req, res) => {
  try {
    const cfg = await getSettings([
      'payment_enabled', 'online_payment_enabled', 'cod_enabled',
      'payment_provider', 'payment_mode', 'currency', 'razorpay_key_id',
    ]);
    res.json({
      success: true,
      data: {
        payment_enabled:       cfg.payment_enabled       || '0',
        online_payment_enabled: cfg.online_payment_enabled || '0',
        cod_enabled:           cfg.cod_enabled           || '1',
        payment_provider:      cfg.payment_provider      || 'razorpay',
        payment_mode:          cfg.payment_mode          || 'test',
        currency:              cfg.currency              || 'INR',
        razorpay_key_id:       cfg.razorpay_key_id       || '',
      },
    });
  } catch (e) {
    console.error('getPublicConfig error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/payments/create-order ─────────────────────────────────────────

const createOrder = async (req, res) => {
  try {
    await ensureColsOnce();

    const cfg = await getSettings([
      'payment_enabled', 'online_payment_enabled',
      'razorpay_key_id', 'razorpay_key_secret', 'currency', 'payment_mode',
    ]);

    if (cfg.payment_enabled !== '1') {
      return res.status(400).json({ success: false, message: 'Payments are currently disabled.' });
    }
    if (cfg.online_payment_enabled !== '1') {
      return res.status(400).json({ success: false, message: 'Online payment is not enabled.' });
    }
    if (!cfg.razorpay_key_id || !cfg.razorpay_key_secret || cfg.razorpay_key_secret === '********' || cfg.razorpay_key_secret.trim() === '') {
      return res.status(400).json({ success: false, message: 'Razorpay configuration missing' });
    }

    const keyId = String(cfg.razorpay_key_id).trim();
    const isTestKey = keyId.startsWith('rzp_test_');
    const isLiveKey = keyId.startsWith('rzp_live_');
    if (!isTestKey && !isLiveKey) {
      return res.status(400).json({ success: false, message: 'Razorpay Key ID is invalid. It must start with rzp_test_ or rzp_live_.' });
    }
    const configuredMode = String(cfg.payment_mode || '').toLowerCase();
    if (configuredMode && ((configuredMode === 'test' && !isTestKey) || (configuredMode === 'live' && !isLiveKey))) {
      return res.status(400).json({
        success: false,
        message: `Razorpay mode mismatch: payment_mode is ${configuredMode} but key_id does not match.`,
      });
    }

    const { order_id, amount, currency } = req.body;
    if (!order_id || !amount) {
      return res.status(400).json({ success: false, message: 'order_id and amount are required.' });
    }

    const Razorpay = require('razorpay');
    const rzp = new Razorpay({
      key_id: cfg.razorpay_key_id,
      key_secret: cfg.razorpay_key_secret,
    });

    const amountPaise = Math.round(Number(amount) * 100);
    const rzpOrder = await rzp.orders.create({
      amount: amountPaise,
      currency: currency || cfg.currency || 'INR',
      receipt: `bb_${order_id}`,
      notes: { order_id: String(order_id) },
    });

    // Store razorpay_order_id on merchandise order
    await executeQuery(
      "UPDATE merchandise_orders SET payment_order_id = ?, payment_status = 'payment_initiated', payment_provider = 'razorpay' WHERE id = ?",
      [rzpOrder.id, order_id]
    );

    res.json({
      success: true,
      data: {
        razorpay_order_id: rzpOrder.id,
        amount: amountPaise,
        currency: rzpOrder.currency,
        key_id: cfg.razorpay_key_id,
      },
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    const msg = error?.error?.description || error?.message || 'Unable to create payment order';
    res.status(400).json({
      success: false,
      message: 'Unable to create payment order',
      error: process.env.NODE_ENV === 'development' ? msg : undefined,
    });
  }
};

// ─── POST /api/payments/verify ────────────────────────────────────────────────

const verifyPayment = async (req, res) => {
  try {
    await ensureColsOnce();

    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'All payment fields are required.' });
    }

    const secret = await getSetting('razorpay_key_secret');
    if (!secret) {
      return res.status(500).json({ success: false, message: 'Payment secret not configured.' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(razorpay_signature, 'hex'));

    if (valid) {
      await executeQuery(
        `UPDATE merchandise_orders
         SET payment_status = 'paid', payment_provider = 'razorpay',
             payment_order_id = ?, payment_id = ?, payment_signature = ?, paid_at = NOW()
         WHERE id = ?`,
        [razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id]
      );

      // Create admin notification for payment success
      try {
        const orderRows = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [order_id]);
        if (orderRows.length) {
          const order = orderRows[0];
          createAdminNotification({
            type: 'payment_success',
            title: 'Payment Received',
            message: `Payment received for Order #${order.order_number} - ₹${order.total_amount}`,
            module_name: 'merchandise_orders',
            record_id: order_id,
            action_url: `/admin/merchandise-orders/${order_id}`,
            priority: 'normal',
            metadata: { order_number: order.order_number, total_amount: order.total_amount, payment_id: razorpay_payment_id }
          }).catch(err => console.warn('Admin notification failed:', err.message));
        }
      } catch (e) {
        console.warn('Payment success notification error:', e.message);
      }

      // Deduct stock after successful online payment
      try {
        const { deductStock } = require('./merchandiseOrderController');
        const items = await executeQuery(
          'SELECT merchandise_id, quantity FROM merchandise_order_items WHERE order_id = ?',
          [order_id]
        );
        await deductStock(items);
      } catch (e) {
        console.error('Stock deduction error after payment verify:', e);
      }
      // Status history + auto email after online payment
      try {
        const { addHistory } = require('./merchandiseOrderController');
        if (typeof addHistory === 'function') await addHistory(order_id, 'payment_confirmed', 'Online payment verified');
      } catch (_) {}
      try {
        const orderRows = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [order_id]);
        if (orderRows.length) {
          const { sendOrderEmail, sendAdminOrderNotification } = require('../services/mailService');
          await sendOrderEmail(orderRows[0], 'payment_confirmed');
          await sendAdminOrderNotification(orderRows[0]);
        }
      } catch (e) {
        console.error('Auto email after payment verify error:', e.message);
      }
      res.json({ success: true, message: 'Payment verified successfully.' });
    } else {
      await executeQuery(
        "UPDATE merchandise_orders SET payment_status = 'failed' WHERE id = ?",
        [order_id]
      );

      // Create admin notification for payment failed
      try {
        const orderRows = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [order_id]);
        if (orderRows.length) {
          const order = orderRows[0];
          createAdminNotification({
            type: 'payment_failed',
            title: 'Payment Failed',
            message: `Payment failed for Order #${order.order_number}`,
            module_name: 'merchandise_orders',
            record_id: order_id,
            action_url: `/admin/merchandise-orders/${order_id}`,
            priority: 'high',
            metadata: { order_number: order.order_number, total_amount: order.total_amount }
          }).catch(err => console.warn('Admin notification failed:', err.message));
        }
      } catch (e) {
        console.warn('Payment failed notification error:', e.message);
      }

      res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }
  } catch (e) {
    console.error('verifyPayment error:', e);
    res.status(500).json({ success: false, message: 'Internal server error during verification.' });
  }
};

// ─── POST /api/payments/webhook ───────────────────────────────────────────────

const webhook = async (req, res) => {
  try {
    const webhookSecret = await getSetting('razorpay_webhook_secret');
    const signature = req.headers['x-razorpay-signature'];

    if (webhookSecret && signature) {
      const body = req.rawBody || JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
      if (expected !== signature) {
        console.warn('Webhook signature mismatch');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const event = req.body?.event;
    const paymentEntity = req.body?.payload?.payment?.entity;

    if (event === 'payment.captured' && paymentEntity) {
      const { id: payment_id, order_id: razorpay_order_id, amount, currency } = paymentEntity;
      console.log(`Webhook: payment.captured — payment_id=${payment_id}, order_id=${razorpay_order_id}, amount=${amount} ${currency}`);
      await executeQuery(
        `UPDATE merchandise_orders
         SET payment_status = 'paid', payment_id = ?, paid_at = NOW()
         WHERE payment_order_id = ? AND payment_status != 'paid'`,
        [payment_id, razorpay_order_id]
      );
    } else if (event === 'payment.failed' && paymentEntity) {
      const { order_id: razorpay_order_id } = paymentEntity;
      console.log(`Webhook: payment.failed — order_id=${razorpay_order_id}`);
      await executeQuery(
        "UPDATE merchandise_orders SET payment_status = 'failed' WHERE payment_order_id = ? AND payment_status = 'pending'",
        [razorpay_order_id]
      );
    } else {
      console.log(`Webhook: unhandled event — ${event}`);
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

// ─── POST /api/payments/test-order (admin test — creates ₹1 order, no real charge) ──

const testOrder = async (req, res) => {
  try {
    const cfg = await getSettings(['payment_enabled', 'razorpay_key_id', 'razorpay_key_secret', 'payment_mode']);
    if (cfg.payment_enabled !== '1') {
      return res.json({ success: false, message: 'Payments not enabled. Enable Payment in Settings first.' });
    }
    if (!cfg.razorpay_key_id || !cfg.razorpay_key_secret) {
      return res.json({ success: false, message: 'Razorpay Key ID and Key Secret are required.' });
    }
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({ key_id: cfg.razorpay_key_id, key_secret: cfg.razorpay_key_secret });
    const order = await rzp.orders.create({ amount: 100, currency: 'INR', receipt: 'admin_test' });
    res.json({
      success: true,
      message: `Razorpay connection OK! Mode: ${cfg.payment_mode || 'test'}. Test order created: ${order.id}`,
    });
  } catch (e) {
    const msg = e?.error?.description || e?.message || 'Razorpay connection failed.';
    res.json({ success: false, message: `Razorpay error: ${msg}` });
  }
};

module.exports = { getPublicConfig, validateConfig, createOrder, verifyPayment, webhook, testOrder };
