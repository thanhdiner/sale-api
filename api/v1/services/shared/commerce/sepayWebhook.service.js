const mongoose = require('mongoose')
const AppError = require('../../../utils/AppError')
const orderRepository = require('../../../repositories/commerce/order.repository')
const paymentService = require('../../client/commerce/payment.service')

const DEV_SEPAY_WEBHOOK_API_KEY = 'dev_sepay_test_key'

function getSepayWebhookApiKey() {
  if (process.env.SEPAY_WEBHOOK_API_KEY) {
    return process.env.SEPAY_WEBHOOK_API_KEY
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_SEPAY_WEBHOOK_API_KEY
  }

  return ''
}

function getAuthorizationHeader(headers = {}) {
  return headers.authorization || headers.Authorization || ''
}

function verifyAuthorization(headers = {}) {
  const apiKey = getSepayWebhookApiKey()

  if (!apiKey) {
    throw new AppError('Sepay webhook API key is not configured', 500)
  }

  if (getAuthorizationHeader(headers) !== `Apikey ${apiKey}`) {
    throw new AppError('Invalid Sepay webhook API key', 401)
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractObjectId(value) {
  const text = normalizeText(value)
  const match = text.match(/\b[a-f\d]{24}\b/i)
  return match ? match[0] : ''
}

function extractPaymentReference(payload = {}) {
  const candidates = [
    payload.code,
    payload.content,
    payload.description
  ]

  for (const candidate of candidates) {
    const objectId = extractObjectId(candidate)
    if (objectId) return objectId
  }

  for (const candidate of candidates) {
    const text = normalizeText(candidate)
    if (text) return text
  }

  return ''
}

function normalizeAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function getTransactionId(payload = {}) {
  return normalizeText(payload.referenceCode) || normalizeText(payload.id) || `sepay_${Date.now()}`
}

function ensureExpectedBankAccount(payload = {}) {
  const expectedAccount = normalizeText(process.env.SEPAY_BANK_ACCOUNT)
  const actualAccount = normalizeText(payload.accountNumber)

  if (expectedAccount && actualAccount && actualAccount !== expectedAccount) {
    throw new AppError('Sepay bank account does not match', 400)
  }
}

async function findOrderByPaymentReference(reference) {
  if (!reference) return null

  if (mongoose.Types.ObjectId.isValid(reference)) {
    const order = await orderRepository.findById(reference)
    if (order) return order
  }

  return orderRepository.findOne({
    orderCode: reference,
    isDeleted: false
  })
}

async function handleIncomingTransaction({ headers = {}, payload = {} } = {}) {
  verifyAuthorization(headers)

  if (payload.transferType !== 'in') {
    return {
      success: true,
      ignored: true,
      reason: 'not_incoming_transfer'
    }
  }

  ensureExpectedBankAccount(payload)

  const paymentReference = extractPaymentReference(payload)
  const order = await findOrderByPaymentReference(paymentReference)

  if (!order || order.isDeleted) {
    throw new AppError('Order not found for Sepay transaction', 404)
  }

  if (order.paymentMethod !== 'sepay') {
    throw new AppError('Order payment method is not Sepay', 400)
  }

  const transferAmount = normalizeAmount(payload.transferAmount)
  if (transferAmount <= 0) {
    throw new AppError('Invalid Sepay transfer amount', 400)
  }

  if (Number(order.total) !== transferAmount) {
    throw new AppError('Sepay transfer amount does not match order total', 400, {
      expectedAmount: order.total,
      transferAmount
    })
  }

  if (order.paymentStatus === 'paid') {
    return {
      success: true,
      processed: false,
      reason: 'already_paid',
      order
    }
  }

  if (paymentService.isClosedForPayment(order) || paymentService.isPaymentWindowExpired(order)) {
    await paymentService.closeExpiredPaymentOrder(order)
    throw new AppError('Order is closed or expired for payment', 410)
  }

  const transactionId = getTransactionId(payload)
  const processed = await paymentService.finalizeSuccessfulPayment(order, transactionId)

  return {
    success: true,
    processed,
    order,
    transactionId
  }
}

module.exports = {
  handleIncomingTransaction,
  findOrderByPaymentReference,
  getSepayWebhookApiKey
}










