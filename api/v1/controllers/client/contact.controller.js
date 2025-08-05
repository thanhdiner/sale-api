const sendMail = require('../../utils/sendMail')

// # POST /api/v1/contact
module.exports.sendContactEmail = async (req, res) => {
  const { name, email, subject, message } = req.body

  if (!email || !message || !subject) {
    return res.status(400).json({ message: 'Email, Chủ đề và Nội dung không được để trống' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return res.status(400).json({ message: 'Email không hợp lệ!' })

  try {
    await sendMail(
      process.env.MAIL_USER,
      `[Contact Form] ${subject || 'Không chủ đề'}`,
      `Tên: ${name || '(không ghi)'}\nEmail: ${email}\nNội dung:\n${message}`,
      `<b>Tên:</b> ${name || '(không ghi)'}<br/><b>Email:</b> ${email}<br/><b>Chủ đề:</b> ${
        subject || '(không ghi)'
      }<br/><b>Nội dung:</b><br/>${message.replace(/\n/g, '<br/>')}`
    )
    res.json({ message: 'Gửi thành công!' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi gửi mail!', error: err.message })
  }
}
