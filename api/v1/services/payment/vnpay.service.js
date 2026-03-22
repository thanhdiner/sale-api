const crypto = require('crypto')
const querystring = require('querystring')

const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE || 'DEMO1234',
  hashSecret: process.env.VNPAY_HASH_SECRET || 'YOUR_HASH_SECRET',
  vnpUrl: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3001/api/v1/payment/vnpay/return'
}

/**
 * Tạo URL thanh toán VNPay
 * @param {Object} params
 * @param {string} params.orderId     - ID đơn hàng trong DB
 * @param {number} params.amount      - Số tiền VNĐ (integer)
 * @param {string} params.orderInfo   - Mô tả đơn hàng
 * @param {string} params.clientIp    - IP của client
 * @param {string} params.locale      - 'vn' | 'en'
 */
function createPaymentUrl({ orderId, amount, orderInfo = 'Thanh toan don hang', clientIp = '127.0.0.1', locale = 'vn' }) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const createDate =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  // Expire time: 15 phút
  const expireDate = new Date(now.getTime() + 15 * 60 * 1000)
  const expireDateStr =
    `${expireDate.getFullYear()}${pad(expireDate.getMonth() + 1)}${pad(expireDate.getDate())}` +
    `${pad(expireDate.getHours())}${pad(expireDate.getMinutes())}${pad(expireDate.getSeconds())}`

  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY_CONFIG.tmnCode,
    vnp_Locale: locale,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId, // dùng orderId làm mã giao dịch
    vnp_OrderInfo: orderInfo.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 255),
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100, // VNPay nhân 100
    vnp_ReturnUrl: VNPAY_CONFIG.returnUrl,
    vnp_IpAddr: clientIp,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDateStr,
    vnp_BankCode: '' // rỗng = cho user chọn
  }

  // Loại bỏ key rỗng, sort alphabetical
  const sortedParams = Object.fromEntries(
    Object.entries(vnpParams)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
  )

  const signData = querystring.stringify(sortedParams, { encode: false })
  const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
  const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  return `${VNPAY_CONFIG.vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`
}

/**
 * Xác minh chữ ký từ VNPay redirect/IPN
 * @param {Object} vnpParams - query params từ VNPay
 * @returns {{ isValid: boolean, isSuccess: boolean, orderId: string, amount: number }}
 */
function verifyReturn(vnpParams) {
  const secureHash = vnpParams.vnp_SecureHash
  const params = { ...vnpParams }
  delete params.vnp_SecureHash
  delete params.vnp_SecureHashType

  const sortedParams = Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
  )

  const signData = querystring.stringify(sortedParams, { encode: false })
  const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret)
  const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  const isValid = calculatedHash === secureHash
  const isSuccess = vnpParams.vnp_ResponseCode === '00'
  const orderId = vnpParams.vnp_TxnRef
  const amount = parseInt(vnpParams.vnp_Amount) / 100

  return { isValid, isSuccess, orderId, amount, transactionId: vnpParams.vnp_TransactionNo }
}

module.exports = { createPaymentUrl, verifyReturn }
