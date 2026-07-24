const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const defaultPrivacyContent = `Introduction

Big Bean Café is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose and protect information about you when you visit our website, use our mobile app, visit our outlets or use any of our services.

By using our services, you agree to the collection and use of information in accordance with this policy.

Information We Collect

We may collect the following types of information:
- Personal information: name, email address, phone number, date of birth
- Account information: login credentials and profile details
- Order information: items ordered, delivery address, payment details
- Device information: IP address, browser type, operating system
- Usage information: pages visited, time spent, interactions on our website

How We Use Information

We use the information we collect to:
- Process your orders and deliver products
- Send order confirmations and updates
- Personalise your experience on our website and app
- Send promotional offers, events and newsletters (with your consent)
- Improve our services and website
- Comply with legal obligations

Cookies & Tracking

Our website uses cookies and similar tracking technologies to enhance your experience. Cookies help us remember your preferences, analyse site traffic and personalise content.

You can control cookies through your browser settings. Disabling cookies may affect some features of our website.

Data Protection

We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure or destruction.

We retain your data only as long as necessary to fulfil the purposes outlined in this policy or as required by law.

Third-Party Services

We may share your information with trusted third-party service providers who assist us in operating our website, processing payments, delivering orders and communicating with you. These parties are bound by confidentiality agreements.

We do not sell, trade or rent your personal information to third parties.

Contact Us

If you have any questions about this Privacy Policy, please contact us at:

Email: info@bigbeancafe.in
Website: www.bigbeancafe.in`;

const defaultTermsContent = `Introduction

Welcome to Big Bean Café. By accessing or using our website, mobile application, services or visiting our outlets, you agree to be bound by these Terms & Conditions. Please read them carefully before using our services.

Website & App Usage

- You must be at least 13 years of age to use our website and app.
- You agree to use our services only for lawful purposes.
- You must not attempt to gain unauthorised access to any part of our systems.
- We reserve the right to modify or discontinue services at any time without notice.
- All content on this website is the property of Big Bean Café and is protected by applicable copyright laws.

Orders & Payments

- All orders placed through our website or app are subject to acceptance and availability.
- Prices are displayed in Indian Rupees (INR) and are inclusive of applicable taxes.
- Payment must be made in full at the time of placing an order.
- We accept major credit/debit cards, UPI and other payment methods as displayed at checkout.
- Order confirmation is sent via email or SMS upon successful payment.

Offers & Promotions

- Promotional offers are valid for the period specified and subject to availability.
- Offers cannot be combined unless explicitly stated.
- Big Bean Café reserves the right to modify or withdraw any offer at any time.
- Misuse of promotional codes may result in cancellation of the order.

Cancellations & Refunds

- Cancellations may be requested within 15 minutes of placing an order.
- Once preparation has begun, cancellations may not be accepted.
- Refunds, if applicable, will be processed within 5–7 business days to the original payment method.
- For any disputes or refund requests, please contact us at info@bigbeancafe.in.

Intellectual Property

All trademarks, logos, product names and brand materials featured on this website are the property of Big Bean Café or their respective owners. Reproduction or use without prior written permission is strictly prohibited.

Limitation of Liability

Big Bean Café shall not be liable for any indirect, incidental, special or consequential damages arising from the use of our website, app or services.

Our total liability for any claim shall not exceed the amount paid by you for the specific product or service giving rise to the claim.

Contact Us

For any questions regarding these Terms & Conditions, please contact us at:

Email: info@bigbeancafe.in
Website: www.bigbeancafe.in`;

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS legal_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page_type ENUM('privacy_policy','terms_conditions') NOT NULL,
      eyebrow VARCHAR(150) NULL,
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      hero_image VARCHAR(500) NULL,
      content LONGTEXT NULL,
      effective_date DATE NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const today = new Date().toISOString().split('T')[0];

  const ppRows = await executeQuery(`SELECT id FROM legal_pages WHERE page_type='privacy_policy' LIMIT 1`);
  if (!ppRows.length) {
    await executeQuery(
      `INSERT INTO legal_pages (page_type, eyebrow, title, highlight_text, subtitle, content, effective_date, status, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      ['privacy_policy','PRIVACY POLICY','Your Privacy','Matters to Us',
       'Learn how Big Bean Café collects, uses and protects your information when you use our website, app, services and outlets.',
       defaultPrivacyContent, today, 'active', 1]
    );
  }

  const tcRows = await executeQuery(`SELECT id FROM legal_pages WHERE page_type='terms_conditions' LIMIT 1`);
  if (!tcRows.length) {
    await executeQuery(
      `INSERT INTO legal_pages (page_type, eyebrow, title, highlight_text, subtitle, content, effective_date, status, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      ['terms_conditions','TERMS & CONDITIONS','Terms of','Using Our Services',
       'Please read these terms carefully before using Big Bean Café website, app, offers, ordering services and digital platforms.',
       defaultTermsContent, today, 'active', 1]
    );
  }

  tableReady = true;
}

function deleteImageFile(imagePath) {
  if (!imagePath) return;
  try {
    const fullPath = path.join(__dirname, '../../', imagePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch {}
}

async function getLegalPages(req, res) {
  try {
    await ensureTable();
    const rows = await executeQuery(
      `SELECT * FROM legal_pages ORDER BY page_type, sort_order, created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch legal pages', error: err.message });
  }
}

async function getLegalPageByType(req, res) {
  try {
    await ensureTable();
    const { pageType } = req.params;
    const rows = await executeQuery(
      `SELECT * FROM legal_pages WHERE page_type=? AND status='active' ORDER BY sort_order ASC LIMIT 1`,
      [pageType]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Legal page not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch legal page', error: err.message });
  }
}

async function getLegalPageById(req, res) {
  try {
    await ensureTable();
    const rows = await executeQuery(`SELECT * FROM legal_pages WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Legal page not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch legal page', error: err.message });
  }
}

async function createLegalPage(req, res) {
  try {
    await ensureTable();
    const { page_type, eyebrow, title, highlight_text, subtitle, content, effective_date, status, sort_order } = req.body;
    if (!page_type || !title) return res.status(400).json({ success: false, message: 'page_type and title are required' });
    const hero_image = req.file ? `uploads/legal-pages/${req.file.filename}` : null;
    const result = await executeQuery(
      `INSERT INTO legal_pages (page_type, eyebrow, title, highlight_text, subtitle, hero_image, content, effective_date, status, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [page_type, eyebrow || null, title, highlight_text || null, subtitle || null,
       hero_image, content || null, effective_date || null, status || 'active', sort_order || 0]
    );
    const rows = await executeQuery(`SELECT * FROM legal_pages WHERE id=?`, [result.insertId]);
    res.status(201).json({ success: true, message: 'Legal page created successfully', data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create legal page', error: err.message });
  }
}

async function updateLegalPage(req, res) {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery(`SELECT * FROM legal_pages WHERE id=?`, [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Legal page not found' });

    const { page_type, eyebrow, title, highlight_text, subtitle, content, effective_date, status, sort_order } = req.body;
    let hero_image = existing[0].hero_image;
    if (req.file) {
      deleteImageFile(hero_image);
      hero_image = `uploads/legal-pages/${req.file.filename}`;
    }

    await executeQuery(
      `UPDATE legal_pages SET page_type=?, eyebrow=?, title=?, highlight_text=?, subtitle=?, hero_image=?, content=?, effective_date=?, status=?, sort_order=? WHERE id=?`,
      [page_type || existing[0].page_type, eyebrow || null, title || existing[0].title,
       highlight_text || null, subtitle || null, hero_image, content || null,
       effective_date || null, status || existing[0].status, sort_order || 0, id]
    );
    const updated = await executeQuery(`SELECT * FROM legal_pages WHERE id=?`, [id]);
    res.json({ success: true, message: 'Legal page updated successfully', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update legal page', error: err.message });
  }
}

async function deleteLegalPage(req, res) {
  try {
    await ensureTable();
    const rows = await executeQuery(`SELECT * FROM legal_pages WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Legal page not found' });
    deleteImageFile(rows[0].hero_image);
    await executeQuery(`DELETE FROM legal_pages WHERE id=?`, [req.params.id]);
    res.json({ success: true, message: 'Legal page deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete legal page', error: err.message });
  }
}

module.exports = { getLegalPages, getLegalPageByType, getLegalPageById, createLegalPage, updateLegalPage, deleteLegalPage };
