const crypto = require('crypto')
const axios = require('axios')
const moment = require('moment')

const ZALOPAY_CONFIG = {
  appId: process.env.ZALOPAY_APP_ID || '2553',
  key1: process.env.ZALOPAY_KEY1 || 'PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL',
  key2: process.env.ZALOPAY_KEY2 || 'kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz',
  endpoint: process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create',
  callbackUrl: process.env.ZALOPAY_CALLBACK_URL || 'http://localhost:3001/api/v1/payment/zalopay/callback',
  redirectUrl: process.env.ZALOPAY_REDIRECT_URL || 'http://localhost:3000/order-success'
}

/**
 * Tạo ZaloPay order
 */
async function createPaymentUrl({ orderId, amount, items = [], description = 'Thanh toan SmartMall' }) {
  const appTransId = `${moment().format('YYMMDD')}_${orderId}`
  const appTime = Date.now()

  const embedData = JSON.stringify({
    orderId,
    redirecturl: ZALOPAY_CONFIG.redirectUrl
  })

  const itemsJson = JSON.stringify(items.length > 0 ? items : [{ itemid: orderId, itemname: 'Đơn hàng SmartMall', itemprice: amount, itemquantity: 1 }])

  // HMAC-SHA256: app_id|app_trans_id|app_user|amount|app_time|embed_data|item
  const rawSignature = [
    ZALOPAY_CONFIG.appId,
    appTransId,
    'user123', // app_user (không cần thiết cho sandbox)
    amount,
    appTime,
    embedData,
    itemsJson
  ].join('|')

  const mac = crypto.createHmac('sha256', ZALOPAY_CONFIG.key1)
    .update(rawSignature)
    .digest('hex')

  const body = {
    app_id: Number(ZALOPAY_CONFIG.appId),
    app_trans_id: appTransId,
    app_user: 'user123',
    app_time: appTime,
    item: itemsJson,
    embed_data: embedData,
    amount,
    description,
    bank_code: '',
    callback_url: ZALOPAY_CONFIG.callbackUrl,
    mac
  }

  const response = await axios.post(ZALOPAY_CONFIG.endpoint, null, { params: body })

  if (response.data.return_code !== 1) {
    throw new Error(response.data.return_message || 'ZaloPay tạo order thất bại')
  }

  return {
    paymentUrl: response.data.order_url,
    appTransId,
    zpTransToken: response.data.zp_trans_token
  }
}

/**
 * Xác minh callback từ ZaloPay
 * @param {Object} body - { data, mac }
 */
function verifyCallback({ data, mac }) {
  const calculatedMac = crypto.createHmac('sha256', ZALOPAY_CONFIG.key2)
    .update(data)
    .digest('hex')

  const isValid = calculatedMac === mac
  let parsedData = {}
  let orderId = null

  try {
    parsedData = JSON.parse(data)
    const embedData = JSON.parse(parsedData.embed_data || '{}')
    orderId = embedData.orderId
  } catch {}

  const isSuccess = parsedData.return_code === 1

  return {
    isValid,
    isSuccess,
    orderId,
    transactionId: String(parsedData.zp_trans_id || ''),
    amount: parsedData.amount
  }
}

module.exports = { createPaymentUrl, verifyCallback }









