const nodemailer = require('nodemailer')
const logger = require('./logger')


// ─── Transporter (reused singleton) ──────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
})

// Verify connection once at startup (non-blocking)
transporter.verify(err => {
  if (err) logger.warn('[Mailer] SMTP connection failed:', err.message)
  else logger.info('[Mailer] SMTP ready ✓')
})

// ─── Core send helper ─────────────────────────────────────────────────────────

/**
 * Send an email. Never throws — logs error and returns false on failure.
 * @param {object} opts - { to, subject, html }
 * @returns {Promise<boolean>}
 */
const sendMail = async ({ to, subject, html }) => {
  if (!to) {
    logger.warn('[Mailer] sendMail called with no recipient — skipped')
    return false
  }
  try {
    const info = await transporter.sendMail({
      from: `"SmartMall 🛒" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html
    })
    logger.info(`[Mailer] Email sent to ${to} — messageId: ${info.messageId}`)
    return true
  } catch (err) {
    logger.error(`[Mailer] Failed to send email to ${to}:`, err.message)
    return false
  }
}

module.exports = { sendMail }





