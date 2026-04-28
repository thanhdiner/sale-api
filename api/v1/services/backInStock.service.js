const AppError = require('../utils/AppError')
const logger = require('../../../config/logger')
const sendMail = require('../utils/sendMail')
const productRepository = require('../repositories/product.repository')
const userRepository = require('../repositories/user.repository')
const backInStockSubscriptionRepository = require('../repositories/backInStockSubscription.repository')

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

const MESSAGES = {
  vi: {
    invalidProductId: 'ID sản phẩm không hợp lệ',
    productNotFound: 'Không tìm thấy sản phẩm',
    emailRequired: 'Vui lòng nhập email để nhận thông báo',
    emailInvalid: 'Email không đúng định dạng',
    alreadyInStock: 'Sản phẩm hiện đã có hàng.',
    alreadyRegistered: 'Email này đã đăng ký nhận thông báo cho sản phẩm.',
    subscribed: 'Đã đăng ký báo khi có hàng.'
  },
  en: {
    invalidProductId: 'Invalid product ID',
    productNotFound: 'Product not found',
    emailRequired: 'Please enter an email to receive notifications',
    emailInvalid: 'Invalid email format',
    alreadyInStock: 'This product is currently in stock.',
    alreadyRegistered: 'This email is already registered for this product.',
    subscribed: 'Back-in-stock notification registered.'
  }
}

const FALLBACK_MESSAGES = {
  vi: {
    notRegistered: 'Email nay chua co dang ky cho san pham.',
    unsubscribed: 'Da huy dang ky bao khi co hang.'
  },
  en: {
    notRegistered: 'This email is not registered for this product.',
    unsubscribed: 'Back-in-stock notification cancelled.'
  }
}

function normalizeLanguage(lang) {
  return String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function message(lang, key) {
  const normalizedLang = normalizeLanguage(lang)
  return MESSAGES[normalizedLang][key]
    || FALLBACK_MESSAGES[normalizedLang]?.[key]
    || MESSAGES.vi[key]
    || FALLBACK_MESSAGES.vi[key]
    || key
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(String(id || ''))
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getProductUrl(product) {
  return product?.slug ? `${CLIENT_URL}/products/${product.slug}` : CLIENT_URL
}

function serializeSubscription(subscription) {
  return {
    id: subscription._id?.toString(),
    productId: subscription.productId?.toString(),
    email: subscription.email,
    status: subscription.status,
    requestedAt: subscription.requestedAt || subscription.createdAt
  }
}

async function resolveNotificationEmail({ email, user }) {
  const normalizedEmail = normalizeEmail(email)
  if (normalizedEmail) return normalizedEmail

  const userId = user?.userId || user?.id
  if (!userId) return ''

  const userRecord = await userRepository.findEmailById(userId)
  return normalizeEmail(userRecord?.email)
}

function buildBackInStockEmail(product) {
  const productTitle = product.title || 'Sản phẩm'
  const productUrl = getProductUrl(product)
  const escapedTitle = escapeHtml(productTitle)
  const escapedUrl = escapeHtml(productUrl)

  return {
    subject: `SmartMall - ${productTitle} đã có hàng`,
    text: [
      'Xin chào,',
      '',
      `${productTitle} đã có hàng trở lại tại SmartMall.`,
      `Xem sản phẩm: ${productUrl}`,
      '',
      'Email này được gửi vì bạn đã đăng ký nhận thông báo khi sản phẩm có hàng.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <h2 style="margin:0 0 12px;color:#0b74e5;">Sản phẩm đã có hàng</h2>
        <p>Xin chào,</p>
        <p><strong>${escapedTitle}</strong> đã có hàng trở lại tại SmartMall.</p>
        <p>
          <a href="${escapedUrl}" style="display:inline-block;background:#0b74e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700;">
            Xem sản phẩm
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">Email này được gửi vì bạn đã đăng ký nhận thông báo khi sản phẩm có hàng.</p>
      </div>
    `
  }
}

async function getActiveProduct(productId, lang = 'vi') {
  if (!isValidObjectId(productId)) {
    throw new AppError(message(lang, 'invalidProductId'), 400)
  }

  const product = await productRepository.findById(productId, {
    select: '_id title slug stock status deleted'
  })

  if (!product || product.deleted === true || product.status !== 'active') {
    throw new AppError(message(lang, 'productNotFound'), 404)
  }

  return product
}

async function registerBackInStockNotification({ productId, email, user, lang = 'vi' }) {
  const product = await getActiveProduct(productId, lang)
  const notificationEmail = await resolveNotificationEmail({ email, user })

  if (!notificationEmail) {
    throw new AppError(message(lang, 'emailRequired'), 400)
  }

  if (!EMAIL_REGEX.test(notificationEmail)) {
    throw new AppError(message(lang, 'emailInvalid'), 400)
  }

  if (Number(product.stock || 0) > 0) {
    return {
      success: true,
      status: 'already_in_stock',
      alreadyInStock: true,
      message: message(lang, 'alreadyInStock')
    }
  }

  const existing = await backInStockSubscriptionRepository.findPendingByProductAndEmail(product._id, notificationEmail)

  if (existing) {
    return {
      success: true,
      status: 'already_registered',
      alreadyRegistered: true,
      message: message(lang, 'alreadyRegistered'),
      subscription: serializeSubscription(existing)
    }
  }

  const subscription = await backInStockSubscriptionRepository.create({
    productId: product._id,
    userId: user?.userId || user?.id || null,
    email: notificationEmail,
    productSnapshot: {
      title: product.title || '',
      slug: product.slug || ''
    }
  })

  return {
    success: true,
    status: 'subscribed',
    message: message(lang, 'subscribed'),
    subscription: serializeSubscription(subscription)
  }
}

async function unregisterBackInStockNotification({ productId, email, user, lang = 'vi' }) {
  const product = await getActiveProduct(productId, lang)
  const notificationEmail = await resolveNotificationEmail({ email, user })

  if (!notificationEmail) {
    throw new AppError(message(lang, 'emailRequired'), 400)
  }

  if (!EMAIL_REGEX.test(notificationEmail)) {
    throw new AppError(message(lang, 'emailInvalid'), 400)
  }

  const subscription = await backInStockSubscriptionRepository.cancelPendingByProductAndEmail(product._id, notificationEmail)

  if (!subscription) {
    return {
      success: true,
      status: 'not_registered',
      notRegistered: true,
      message: message(lang, 'notRegistered')
    }
  }

  return {
    success: true,
    status: 'unsubscribed',
    unsubscribed: true,
    message: message(lang, 'unsubscribed'),
    subscription: serializeSubscription(subscription)
  }
}

async function notifyBackInStockForProduct(productId) {
  if (!isValidObjectId(productId)) {
    return { success: false, sent: 0, failed: 0, reason: 'invalid_product_id' }
  }

  const product = await productRepository.findById(productId, {
    select: '_id title slug stock status deleted',
    lean: true
  })

  if (!product || product.deleted === true || product.status !== 'active' || Number(product.stock || 0) <= 0) {
    return { success: true, sent: 0, failed: 0, skipped: true }
  }

  const subscriptions = await backInStockSubscriptionRepository.findPendingByProductId(product._id)
  if (!subscriptions.length) {
    return { success: true, sent: 0, failed: 0 }
  }

  const email = buildBackInStockEmail(product)
  const sentIds = []
  let failed = 0

  for (const subscription of subscriptions) {
    try {
      await sendMail(subscription.email, email.subject, email.text, email.html)
      sentIds.push(subscription._id)
    } catch (error) {
      failed += 1
      logger.warn('[BackInStock] Failed to send notification', {
        productId: product._id?.toString(),
        subscriptionId: subscription._id?.toString(),
        email: subscription.email,
        error: error.message
      })
    }
  }

  await backInStockSubscriptionRepository.markNotified(sentIds)

  return {
    success: true,
    sent: sentIds.length,
    failed
  }
}

module.exports = {
  registerBackInStockNotification,
  unregisterBackInStockNotification,
  notifyBackInStockForProduct
}
