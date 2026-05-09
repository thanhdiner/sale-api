const crypto = require('crypto')
const axios = require('axios')

const MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO',
  accessKey: process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85',
  secretKey: process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
  redirectUrl: process.env.MOMO_REDIRECT_URL || 'http://localhost:3000/order-success',
  ipnUrl: process.env.MOMO_IPN_URL || 'http://localhost:3001/api/v1/payment/momo/callback'
}

/**
 * Tạo payment URL MoMo
 */
async function createPaymentUrl({ orderId, amount, orderInfo = 'Thanh toan don hang SmartMall' }) {
  const requestId = `${orderId}_${Date.now()}`
  const requestType = 'payWithMethod'
  const extraData = Buffer.from(JSON.stringify({ orderId })).toString('base64')

  const rawSignature =
    `accessKey=${MOMO_CONFIG.accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${MOMO_CONFIG.ipnUrl}` +
    `&orderId=${requestId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${MOMO_CONFIG.partnerCode}` +
    `&redirectUrl=${MOMO_CONFIG.redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`

  const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
    .update(rawSignature)
    .digest('hex')

  const body = {
    partnerCode: MOMO_CONFIG.partnerCode,
    accessKey: MOMO_CONFIG.accessKey,
    requestId,
    amount: String(amount),
    orderId: requestId,
    orderInfo,
    redirectUrl: MOMO_CONFIG.redirectUrl,
    ipnUrl: MOMO_CONFIG.ipnUrl,
    extraData,
    requestType,
    signature,
    lang: 'vi'
  }

  const response = await axios.post(MOMO_CONFIG.endpoint, body, {
    headers: { 'Content-Type': 'application/json' }
  })

  if (response.data.resultCode !== 0) {
    throw new Error(response.data.message || 'MoMo tạo payment thất bại')
  }

  return {
    paymentUrl: response.data.payUrl,
    requestId,
    deeplink: response.data.deeplink
  }
}

/**
 * Xác minh IPN callback từ MoMo
 * @param {Object} params - body từ MoMo callback
 */
function verifyCallback(params) {
  const {
    partnerCode, orderId, requestId, amount, orderInfo,
    orderType, transId, resultCode, message, payType,
    responseTime, extraData, signature
  } = params

  const rawSignature =
    `accessKey=${MOMO_CONFIG.accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&message=${message}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&orderType=${orderType}` +
    `&partnerCode=${partnerCode}` +
    `&payType=${payType}` +
    `&requestId=${requestId}` +
    `&responseTime=${responseTime}` +
    `&resultCode=${resultCode}` +
    `&transId=${transId}`

  const calculatedSignature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
    .update(rawSignature)
    .digest('hex')

  const isValid = calculatedSignature === signature
  const isSuccess = resultCode === 0

  // Decode orderId thật từ extraData
  let realOrderId = orderId
  try {
    const decoded = JSON.parse(Buffer.from(extraData, 'base64').toString('utf-8'))
    realOrderId = decoded.orderId || orderId
  } catch {}

  return { isValid, isSuccess, orderId: realOrderId, transactionId: String(transId), amount: Number(amount) }
}

module.exports = { createPaymentUrl, verifyCallback }









