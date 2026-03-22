const crypto = require('crypto')
const qs = require('qs')
const logger = require('../../../../config/logger')

const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE || 'DEMO1234',
  hashSecret: process.env.VNPAY_HASH_SECRET || 'YOUR_HASH_SECRET',
  vnpUrl: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3001/api/v1/payment/vnpay/return'
}

/**
 * Sort object by key và encode từng value theo chuẩn VNPay:
 * encodeURIComponent(value).replace(/%20/g, '+')
 */
function sortObject(obj) {
  const sorted = {}
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    sorted[key] = encodeURIComponent(String(obj[key])).replace(/%20/g, '+')
  }
  return sorted
}

/**
 * Tạo URL thanh toán VNPay
 */
function createPaymentUrl({ orderId, amount, orderInfo, clientIp = '127.0.0.1', locale = 'vn' }) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')

  const createDate =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  const expireDate = new Date(now.getTime() + 15 * 60 * 1000)
  const expireDateStr =
    `${expireDate.getFullYear()}${pad(expireDate.getMonth() + 1)}${pad(expireDate.getDate())}` +
    `${pad(expireDate.getHours())}${pad(expireDate.getMinutes())}${pad(expireDate.getSeconds())}`

  // vnp_OrderInfo: chỉ dùng ASCII, không dùng tiếng Việt
  const cleanOrderInfo = orderInfo
    ? orderInfo.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().substring(0, 255)
    : `DH_${orderId}`

  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY_CONFIG.tmnCode,
    vnp_Locale: locale,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: cleanOrderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: Math.round(amount) * 100,
    vnp_ReturnUrl: VNPAY_CONFIG.returnUrl,
    vnp_IpAddr: clientIp,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDateStr
  }

  // Sort + encode từng value theo chuẩn VNPay
  const sortedParams = sortObject(vnpParams)

  // Build signData từ params đã encode, dùng encode:false vì đã tự encode
  const signData = qs.stringify(sortedParams, { encode: false })

  const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
  const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  // Append hash vào params rồi build URL
  sortedParams.vnp_SecureHash = secureHash
  const paymentUrl = `${VNPAY_CONFIG.vnpUrl}?${qs.stringify(sortedParams, { encode: false })}`

  logger.debug('[VNPay] signData:', { signData })
  logger.debug('[VNPay] secureHash:', { secureHash })

  return paymentUrl
}

/**
 * Xác minh chữ ký từ VNPay redirect
 */
function verifyReturn(vnpParams) {
  const secureHash = vnpParams.vnp_SecureHash
  const params = { ...vnpParams }
  delete params.vnp_SecureHash
  delete params.vnp_SecureHashType

  const sortedParams = sortObject(params)

  const signData = qs.stringify(sortedParams, { encode: false })
  const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
  const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  const isValid = calculatedHash === secureHash
  const isSuccess = vnpParams.vnp_ResponseCode === '00'
  const orderId = vnpParams.vnp_TxnRef
  const amount = parseInt(vnpParams.vnp_Amount) / 100

  return { isValid, isSuccess, orderId, amount, transactionId: vnpParams.vnp_TransactionNo }
}

module.exports = { createPaymentUrl, verifyReturn }
