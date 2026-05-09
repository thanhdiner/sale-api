const mongoose = require('mongoose')
const AppError = require('../../../utils/AppError')
const quickReplyRepository = require('../../../repositories/chatbot/quickReply.repository')

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100
const VARIABLE_PATTERN = /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g
const SHORTCUT_PATTERN = /^\/[a-z0-9][a-z0-9-_]{1,62}$/
const DEFAULT_QUICK_REPLIES = [
  {
    title: 'Chào khách',
    category: 'greeting',
    shortcut: '/hello',
    content: 'Dạ em chào anh/chị, Smartmall có thể hỗ trợ gì cho mình ạ?',
    language: 'vi'
  },
  {
    title: 'Xin mã đơn hàng',
    category: 'info',
    shortcut: '/order-code',
    content: 'Dạ anh/chị gửi giúp em mã đơn hàng để em kiểm tra thông tin cho mình ạ.',
    language: 'vi'
  },
  {
    title: 'Xin email hoặc số điện thoại',
    category: 'info',
    shortcut: '/contact-info',
    content: 'Dạ anh/chị gửi giúp em email/số điện thoại đã đặt hàng để em kiểm tra ạ.',
    language: 'vi'
  },
  {
    title: 'Đơn hàng đang xử lý',
    category: 'order',
    shortcut: '/order-processing',
    content: 'Dạ đơn hàng của mình đang được xử lý, bên em sẽ cập nhật sớm nhất ạ.',
    language: 'vi'
  },
  {
    title: 'Đơn hàng đã xác nhận',
    category: 'order',
    shortcut: '/order-confirmed',
    content: 'Dạ đơn hàng của mình đã được xác nhận và đang chờ giao thông tin tài khoản ạ.',
    language: 'vi'
  },
  {
    title: 'Đã ghi nhận thanh toán',
    category: 'payment',
    shortcut: '/payment-received',
    content: 'Dạ bên em đã ghi nhận thanh toán của mình, em sẽ kiểm tra và phản hồi ngay ạ.',
    language: 'vi'
  },
  {
    title: 'Thanh toán chưa thành công',
    category: 'payment',
    shortcut: '/payment-failed',
    content: 'Dạ thanh toán hiện chưa thành công, anh/chị vui lòng thử lại hoặc chọn phương thức khác ạ.',
    language: 'vi'
  },
  {
    title: 'Xin ảnh/video lỗi',
    category: 'warranty',
    shortcut: '/warranty-media',
    content: 'Dạ anh/chị gửi giúp em ảnh hoặc video lỗi đang gặp để bên em kiểm tra và hỗ trợ bảo hành nhanh hơn ạ.',
    language: 'vi'
  },
  {
    title: 'Chính sách bảo hành',
    category: 'warranty',
    shortcut: '/warranty-policy',
    content: 'Dạ sản phẩm này được hỗ trợ theo chính sách bảo hành ghi trong mô tả sản phẩm ạ.',
    language: 'vi'
  },
  {
    title: 'Kết thúc hỗ trợ',
    category: 'closing',
    shortcut: '/thanks',
    content: 'Dạ Smartmall cảm ơn anh/chị đã liên hệ. Nếu cần hỗ trợ thêm, anh/chị cứ nhắn lại cho bên em ạ.',
    language: 'vi'
  },
  {
    title: 'Greet customer',
    category: 'greeting',
    shortcut: '/hello',
    content: 'Hello, Smartmall support here. How can I help you today?',
    language: 'en'
  },
  {
    title: 'Ask for order code',
    category: 'info',
    shortcut: '/order-code',
    content: 'Please send me your order code so I can check the details for you.',
    language: 'en'
  },
  {
    title: 'Ask for email or phone',
    category: 'info',
    shortcut: '/contact-info',
    content: 'Please send me the email or phone number used for the order so I can check it.',
    language: 'en'
  },
  {
    title: 'Order is processing',
    category: 'order',
    shortcut: '/order-processing',
    content: 'Your order is being processed. We will update you as soon as possible.',
    language: 'en'
  },
  {
    title: 'Order confirmed',
    category: 'order',
    shortcut: '/order-confirmed',
    content: 'Your order has been confirmed and is waiting for account delivery details.',
    language: 'en'
  },
  {
    title: 'Payment received',
    category: 'payment',
    shortcut: '/payment-received',
    content: 'We have recorded your payment. I will check it and respond shortly.',
    language: 'en'
  },
  {
    title: 'Payment failed',
    category: 'payment',
    shortcut: '/payment-failed',
    content: 'The payment has not completed successfully. Please try again or choose another payment method.',
    language: 'en'
  },
  {
    title: 'Ask for issue media',
    category: 'warranty',
    shortcut: '/warranty-media',
    content: 'Please send me a photo or video of the issue so we can check and support the warranty request faster.',
    language: 'en'
  },
  {
    title: 'Warranty policy',
    category: 'warranty',
    shortcut: '/warranty-policy',
    content: 'This product is supported under the warranty policy listed in the product description.',
    language: 'en'
  },
  {
    title: 'Close conversation',
    category: 'closing',
    shortcut: '/thanks',
    content: 'Smartmall thanks you for contacting us. If you need more support, please message us again.',
    language: 'en'
  }
]

const isTruthy = value => value === true || value === 'true' || value === 1 || value === '1'
const isFalsy = value => value === false || value === 'false' || value === 0 || value === '0'

function parseBoolean(value, fieldName) {
  if (typeof value === 'undefined' || value === null || value === '') return undefined
  if (isTruthy(value)) return true
  if (isFalsy(value)) return false
  throw new AppError(`${fieldName} is invalid`, 400)
}

function ensureValidObjectId(id, message = 'Invalid quick reply ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCategory(value) {
  return normalizeText(value).toLowerCase()
}

function normalizeLanguage(value) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function normalizeShortcut(value) {
  const rawShortcut = normalizeText(value).toLowerCase()
  const shortcut = rawShortcut.startsWith('/') ? rawShortcut : `/${rawShortcut}`

  if (!SHORTCUT_PATTERN.test(shortcut)) {
    throw new AppError('Shortcut must start with / and use letters, numbers, hyphen, or underscore', 400)
  }

  return shortcut
}

function getCurrentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractVariables(content) {
  const variables = new Set()
  let match = VARIABLE_PATTERN.exec(content)

  while (match) {
    variables.add(match[1])
    match = VARIABLE_PATTERN.exec(content)
  }

  VARIABLE_PATTERN.lastIndex = 0
  return variables
}

function normalizeVariables(variables, content = '') {
  const values = new Set(extractVariables(content))

  if (Array.isArray(variables)) {
    variables.forEach(variable => {
      const normalized = normalizeText(variable)
      if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(normalized)) {
        values.add(normalized)
      }
    })
  }

  return Array.from(values).sort((left, right) => left.localeCompare(right))
}

function normalizeUser(user = {}) {
  const accountId = user.userId || user.id || user._id || user.accountId
  const name = user.fullName || user.name || user.username || user.email

  if (!accountId && !name) {
    return undefined
  }

  return {
    ...(accountId ? { accountId: String(accountId) } : {}),
    ...(name ? { name: String(name) } : {})
  }
}

function buildTextSearch(value) {
  return { $regex: escapeRegex(value), $options: 'i' }
}

function buildListQuery(params = {}) {
  const query = { isDeleted: false }
  const search = normalizeText(params.search || params.keyword)
  const category = normalizeCategory(params.category)
  const status = normalizeText(params.status).toLowerCase()
  const language = normalizeText(params.language).toLowerCase()
  const explicitActive = Object.prototype.hasOwnProperty.call(params, 'isActive')
    ? parseBoolean(params.isActive, 'isActive')
    : undefined

  if (category) {
    query.category = category
  }

  if (language === 'vi' || language === 'en') {
    query.language = language
  }

  if (typeof explicitActive === 'boolean') {
    query.isActive = explicitActive
  } else if (status === 'active') {
    query.isActive = true
  } else if (status === 'inactive') {
    query.isActive = false
  }

  if (search) {
    const textSearch = buildTextSearch(search)
    query.$or = [
      { title: textSearch },
      { category: textSearch },
      { shortcut: textSearch },
      { content: textSearch }
    ]
  }

  return query
}

async function getQuickReplyByIdOrThrow(id, options = {}) {
  ensureValidObjectId(id)

  const quickReply = options.includeDeleted
    ? await quickReplyRepository.findById(id)
    : await quickReplyRepository.findByIdNotDeleted(id)

  if (!quickReply) {
    throw new AppError(options.message || 'Quick reply not found', 404)
  }

  return quickReply
}

async function assertShortcutAvailable({ shortcut, language, excludeId }) {
  const query = { shortcut, language, isDeleted: false }

  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  const existing = await quickReplyRepository.findOne(query)
  if (existing) {
    throw new AppError('Shortcut already exists for this language', 409)
  }
}

function normalizeWritePayload(payload = {}, options = {}) {
  const requireAllFields = options.requireAllFields === true
  const normalized = {}

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'title')) {
    normalized.title = normalizeText(payload.title)
    if (normalized.title.length < 2) throw new AppError('Title is required', 400)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'category')) {
    normalized.category = normalizeCategory(payload.category)
    if (!normalized.category) throw new AppError('Category is required', 400)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'shortcut')) {
    normalized.shortcut = normalizeShortcut(payload.shortcut)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'content')) {
    normalized.content = normalizeText(payload.content)
    if (normalized.content.length < 2) throw new AppError('Content is required', 400)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'language')) {
    normalized.language = normalizeLanguage(payload.language)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    normalized.isActive = parseBoolean(payload.isActive, 'isActive')
    if (typeof normalized.isActive === 'undefined') {
      if (requireAllFields) {
        normalized.isActive = true
      } else {
        delete normalized.isActive
      }
    }
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'variables')) {
    const content = Object.prototype.hasOwnProperty.call(normalized, 'content') ? normalized.content : payload.content
    normalized.variables = normalizeVariables(payload.variables, normalizeText(content))
  }

  return normalized
}

async function getStats() {
  const monthKey = getCurrentMonthKey()
  const [stats] = await quickReplyRepository.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        categories: { $addToSet: '$category' },
        usedThisMonth: {
          $sum: {
            $cond: [
              { $eq: ['$usageMonthKey', monthKey] },
              '$usageThisMonth',
              0
            ]
          }
        }
      }
    }
  ])

  return {
    total: stats?.total || 0,
    active: stats?.active || 0,
    categories: (stats?.categories || []).filter(Boolean).length,
    usedThisMonth: stats?.usedThisMonth || 0
  }
}

async function ensureDefaultQuickReplies() {
  const existingCount = await quickReplyRepository.countByQuery({ isDeleted: false })

  if (existingCount > 0) {
    return
  }

  const systemUser = { name: 'System' }
  const usageMonthKey = getCurrentMonthKey()

  for (const reply of DEFAULT_QUICK_REPLIES) {
    try {
      await quickReplyRepository.create({
        ...reply,
        variables: normalizeVariables(reply.variables, reply.content),
        isActive: true,
        isDeleted: false,
        usageMonthKey,
        createdBy: systemUser,
        updatedBy: systemUser
      })
    } catch (error) {
      if (error?.code !== 11000) {
        throw error
      }
    }
  }
}

async function listQuickReplies(params = {}) {
  await ensureDefaultQuickReplies()

  const page = parsePositiveInteger(params.page, 1)
  const limit = Math.min(parsePositiveInteger(params.limit, DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT)
  const skip = (page - 1) * limit
  const query = buildListQuery(params)

  const [items, total, stats] = await Promise.all([
    quickReplyRepository.findByQuery(query, {
      sort: { updatedAt: -1, title: 1 },
      skip,
      limit,
      lean: true
    }),
    quickReplyRepository.countByQuery(query),
    getStats()
  ])

  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total
    },
    stats
  }
}

async function listActiveQuickReplies(params = {}) {
  await ensureDefaultQuickReplies()

  const limit = Math.min(parsePositiveInteger(params.limit, MAX_PAGE_LIMIT), MAX_PAGE_LIMIT)
  const query = {
    ...buildListQuery(params),
    isActive: true,
    isDeleted: false
  }

  const items = await quickReplyRepository.findByQuery(query, {
    sort: { category: 1, title: 1 },
    limit,
    lean: true
  })

  return { success: true, data: items }
}

async function createQuickReply(payload = {}, user = null) {
  const normalized = normalizeWritePayload(payload, { requireAllFields: true })
  await assertShortcutAvailable({
    shortcut: normalized.shortcut,
    language: normalized.language
  })

  try {
    const quickReply = await quickReplyRepository.create({
      ...normalized,
      createdBy: normalizeUser(user),
      updatedBy: normalizeUser(user),
      usageMonthKey: getCurrentMonthKey()
    })

    return { success: true, data: quickReply }
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Shortcut already exists for this language', 409)
    }

    if (error?.name === 'ValidationError') {
      throw new AppError('Invalid quick reply data', 400, error.message)
    }

    throw error
  }
}

async function updateQuickReply(id, payload = {}, user = null) {
  const quickReply = await getQuickReplyByIdOrThrow(id)
  const normalized = normalizeWritePayload(payload)
  const nextShortcut = normalized.shortcut || quickReply.shortcut
  const nextLanguage = normalized.language || quickReply.language

  if (normalized.shortcut || normalized.language) {
    await assertShortcutAvailable({
      shortcut: nextShortcut,
      language: nextLanguage,
      excludeId: id
    })
  }

  Object.assign(quickReply, normalized, {
    variables: Object.prototype.hasOwnProperty.call(payload, 'variables') || normalized.content
      ? normalizeVariables(payload.variables || quickReply.variables, normalized.content || quickReply.content)
      : quickReply.variables,
    updatedBy: normalizeUser(user)
  })

  try {
    await quickReply.save()
    return { success: true, data: quickReply }
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Shortcut already exists for this language', 409)
    }

    if (error?.name === 'ValidationError') {
      throw new AppError('Invalid quick reply data', 400, error.message)
    }

    throw error
  }
}

async function setQuickReplyStatus(id, isActive, user = null) {
  const quickReply = await getQuickReplyByIdOrThrow(id)
  quickReply.isActive = parseBoolean(isActive, 'isActive') ?? false
  quickReply.updatedBy = normalizeUser(user)
  await quickReply.save()

  return { success: true, data: quickReply }
}

async function deleteQuickReply(id, user = null) {
  const quickReply = await getQuickReplyByIdOrThrow(id)
  quickReply.isDeleted = true
  quickReply.isActive = false
  quickReply.deletedAt = new Date()
  quickReply.updatedBy = normalizeUser(user)
  await quickReply.save()

  return { success: true }
}

async function recordQuickReplyUsage(id) {
  const quickReply = await getQuickReplyByIdOrThrow(id)

  if (!quickReply.isActive) {
    throw new AppError('Quick reply is inactive', 400)
  }

  const monthKey = getCurrentMonthKey()
  if (quickReply.usageMonthKey !== monthKey) {
    quickReply.usageMonthKey = monthKey
    quickReply.usageThisMonth = 0
  }

  quickReply.usageCount += 1
  quickReply.usageThisMonth += 1
  quickReply.lastUsedAt = new Date()
  await quickReply.save()

  return { success: true, data: quickReply }
}

module.exports = {
  createQuickReply,
  deleteQuickReply,
  listActiveQuickReplies,
  listQuickReplies,
  recordQuickReplyUsage,
  setQuickReplyStatus,
  updateQuickReply
}












