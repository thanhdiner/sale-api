const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
})

module.exports = (to, subject, text, html) => {
  return transporter.sendMail({
    from: `"Support" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text,
    ...(html && { html })
  })
}









