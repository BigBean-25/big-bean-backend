const db = require('../config/database')
const { createAdminNotification } = require('../services/adminNotificationService')

const ensureTable = async () => {
  await db.pool.execute(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(180) NOT NULL UNIQUE,
      source VARCHAR(100) DEFAULT 'footer',
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

exports.subscribe = async (req, res) => {
  try {
    await ensureTable()
    const { email, source = 'footer' } = req.body
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' })
    }
    const cleanEmail = email.trim().toLowerCase()

    const [existing] = await db.pool.execute('SELECT id FROM newsletter_subscribers WHERE email = ?', [cleanEmail])
    if (existing.length > 0) {
      return res.json({ success: true, message: 'You are already subscribed!' })
    }

    const result = await db.pool.execute('INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)', [cleanEmail, source])

    // Create admin notification for new newsletter subscriber
    createAdminNotification({
      type: 'newsletter',
      title: 'New Newsletter Subscriber',
      message: `New subscriber: ${cleanEmail}`,
      module_name: 'newsletter_subscribers',
      record_id: result[0].insertId,
      action_url: '/admin/newsletter-subscribers',
      priority: 'low',
      created_by_type: 'guest',
      created_by_id: null,
      metadata: { email: cleanEmail, source }
    }).catch(err => console.warn('Admin notification failed:', err.message))

    return res.status(201).json({ success: true, message: 'Subscribed successfully!' })
  } catch (err) {
    console.error('Newsletter subscribe error:', err)
    return res.status(500).json({ success: false, message: 'Unable to subscribe. Please try again.' })
  }
}

exports.getSubscribers = async (req, res) => {
  try {
    await ensureTable()
    const [rows] = await db.pool.execute('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC')
    return res.json({ success: true, data: rows })
  } catch (err) {
    console.error('Newsletter getSubscribers error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

exports.updateStatus = async (req, res) => {
  try {
    await ensureTable()
    const { id } = req.params
    const { status } = req.body
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' })
    }
    await db.pool.execute('UPDATE newsletter_subscribers SET status = ? WHERE id = ?', [status, id])
    return res.json({ success: true, message: 'Status updated' })
  } catch (err) {
    console.error('Newsletter updateStatus error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

exports.deleteSubscriber = async (req, res) => {
  try {
    await ensureTable()
    const { id } = req.params
    await db.pool.execute('DELETE FROM newsletter_subscribers WHERE id = ?', [id])
    return res.json({ success: true, message: 'Subscriber deleted' })
  } catch (err) {
    console.error('Newsletter deleteSubscriber error:', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}
