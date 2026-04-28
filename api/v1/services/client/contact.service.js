const sendMail = require('../../utils/sendMail')

const CONTACT_METHODS = ['email', 'phone', 'zalo', 'facebook', 'chat', 'other']
const CONTACT_PRIORITIES = ['low', 'normal', 'high', 'urgent']
const CONTACT_CATEGORIES = [
  'general',
  'order',
  'payment',
  'product',
  'delivery',
  'warranty',
  'refund',
  'complaint',
  'account',
  'technical',
  'other'
]
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function createValidationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function cleanString(value, maxLength = 1000) {
  if (value == null) return ''
  return String(value).trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function cleanMultiline(value, maxLength = 3000) {
  if (value == null) return ''
  return String(value).trim().replace(/\r\n/g, '\n').slice(0, maxLength)
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = cleanString(value, 40).toLowerCase()
  return allowedValues.includes(normalized) ? normalized : fallback
}

function createContactRequestId(date = new Date()) {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '')
  const timePart = date.toISOString().slice(11, 19).replace(/:/g, '')
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CR-${datePart}-${timePart}-${randomPart}`
}

function normalizeContactRequest(payload = {}, context = {}) {
  const customerInfo = context.customerInfo || {}
  const name = cleanString(payload.name || payload.fullName || customerInfo.name, 100)
  const email = cleanString(payload.email || customerInfo.email, 160).toLowerCase()
  const phone = cleanString(payload.phone || customerInfo.phone, 40)
  const subject = cleanString(payload.subject || 'Yeu cau lien he tu live chat', 200)
  const message = cleanMultiline(payload.message || payload.details || context.promptText, 3000)
  const preferredContactMethod = normalizeEnum(
    payload.preferredContactMethod || payload.contactMethod,
    CONTACT_METHODS,
    email ? 'email' : (phone ? 'phone' : 'other')
  )
  const category = normalizeEnum(payload.category || payload.topic, CONTACT_CATEGORIES, 'general')
  const priority = normalizeEnum(payload.priority, CONTACT_PRIORITIES, 'normal')
  const sessionId = cleanString(payload.sessionId || context.sessionId, 120)
  const userId = cleanString(payload.userId || context.userId || customerInfo.userId, 120)
  const source = cleanString(payload.source || context.source || 'chatbot', 80)
  const currentPage = cleanString(payload.currentPage || customerInfo.currentPage, 500)

  if (!email && !phone) {
    throw createValidationError('Can co email hoac so dien thoai de tao yeu cau lien he.')
  }

  if (email && !EMAIL_REGEX.test(email)) {
    throw createValidationError('Email khong hop le.')
  }

  if (!message || message.length < 5) {
    throw createValidationError('Noi dung yeu cau lien he qua ngan.')
  }

  return {
    ticketId: createContactRequestId(),
    name,
    email,
    phone,
    preferredContactMethod,
    category,
    subject,
    message,
    priority,
    sessionId,
    userId,
    source,
    currentPage,
    createdAt: new Date().toISOString()
  }
}

function buildContactRequestEmail(request) {
  const displayName = request.name || '(khong ghi)'
  const displayEmail = request.email || '(khong ghi)'
  const displayPhone = request.phone || '(khong ghi)'
  const subject = `[Contact Request ${request.ticketId}] ${request.subject || 'Khong chu de'}`
  const text = [
    `Ticket: ${request.ticketId}`,
    `Nguon: ${request.source}`,
    `Session: ${request.sessionId || '(khong co)'}`,
    `User: ${request.userId || '(khong co)'}`,
    `Ten: ${displayName}`,
    `Email: ${displayEmail}`,
    `So dien thoai: ${displayPhone}`,
    `Kenh lien he uu tien: ${request.preferredContactMethod}`,
    `Danh muc: ${request.category}`,
    `Muc uu tien: ${request.priority}`,
    `Trang hien tai: ${request.currentPage || '(khong co)'}`,
    `Chu de: ${request.subject}`,
    '',
    'Noi dung:',
    request.message
  ].join('\n')
  const htmlRows = [
    ['Ticket', request.ticketId],
    ['Nguon', request.source],
    ['Session', request.sessionId || '(khong co)'],
    ['User', request.userId || '(khong co)'],
    ['Ten', displayName],
    ['Email', displayEmail],
    ['So dien thoai', displayPhone],
    ['Kenh lien he uu tien', request.preferredContactMethod],
    ['Danh muc', request.category],
    ['Muc uu tien', request.priority],
    ['Trang hien tai', request.currentPage || '(khong co)'],
    ['Chu de', request.subject]
  ]

  const rowsHtml = htmlRows
    .map(([label, value]) => `<p><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</p>`)
    .join('')

  return {
    subject,
    text,
    html: `${rowsHtml}<p><b>Noi dung:</b></p><p>${escapeHtml(request.message).replace(/\n/g, '<br/>')}</p>`
  }
}

async function submitContactRequest(payload = {}, context = {}) {
  const request = normalizeContactRequest(payload, context)
  const email = buildContactRequestEmail(request)

  await sendMail(process.env.MAIL_USER, email.subject, email.text, email.html)

  return {
    success: true,
    ticketId: request.ticketId,
    message: 'Yeu cau lien he da duoc ghi nhan.',
    request: {
      ticketId: request.ticketId,
      name: request.name,
      email: request.email,
      phone: request.phone,
      preferredContactMethod: request.preferredContactMethod,
      category: request.category,
      subject: request.subject,
      priority: request.priority,
      sessionId: request.sessionId,
      userId: request.userId,
      source: request.source,
      currentPage: request.currentPage,
      createdAt: request.createdAt
    }
  }
}

// # POST /api/v1/contact
async function sendContactEmail(req, res) {
  try {
    const result = await submitContactRequest(req.body, { source: 'contact_form' })
    res.json({ message: 'Gui thanh cong!', data: result.request })
  } catch (err) {
    const statusCode = err.statusCode || 500
    const message = statusCode === 400 ? err.message : 'Loi gui mail!'
    res.status(statusCode).json({ message, error: err.message })
  }
}

module.exports = {
  submitContactRequest,
  sendContactEmail
}
