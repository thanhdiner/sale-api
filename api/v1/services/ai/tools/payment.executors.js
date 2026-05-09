/**
 * AI tool executor implementations for the payment domain.
 */

const {
  buildOrderPayload,
  buildPendingPaymentOrderPreview,
  cleanString,
  CLIENT_URL,
  createOnlinePaymentRequest,
  ensureOrderCanResumePayment,
  escapeRegExp,
  formatOrderCode,
  formatPrice,
  getActiveBankInfoPayload,
  getOrderObject,
  getOrderPaymentReference,
  isMongoObjectId,
  isPendingPayableOrder,
  logger,
  normalizeOrderLookupValue,
  normalizePhone,
  normalizeUserId,
  ORDER_STATUS_LABELS,
  orderRepository,
  ordersService,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  paymentService,
  pickString,
  PLACE_ORDER_PAYMENT_METHODS,
  resolveOwnedOrderForPayment,
  serializeId,
  truncateHandoffText,
  userRepository
} = require('./tool.helpers')

function normalizePaymentToolMethod(paymentMethod) {
  const normalized = cleanString(paymentMethod).toLowerCase()
  if (!normalized) return null
  if (normalized === 'card') return 'vnpay'
  return PLACE_ORDER_PAYMENT_METHODS.includes(normalized) ? normalized : null
}

function buildPaymentStatusSelectionPayload(order = {}) {
  const source = getOrderObject(order)

  return {
    ...buildOrderPayload(source),
    statusLabel: ORDER_STATUS_LABELS[source.status] || source.status,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[source.paymentMethod] || source.paymentMethod,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus,
    transactionId: source.paymentTransactionId || null,
    paymentReference: getOrderPaymentReference(source),
    expiresAt: source.reservationExpiresAt || null,
    paymentExpiredAt: source.paymentExpiredAt || null,
    updatedAt: source.updatedAt || null
  }
}

function getPaymentStatusMessage(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const code = formatOrderCode(source)
  const methodLabel = PAYMENT_METHOD_LABELS[source.paymentMethod] || source.paymentMethod || 'khong ro'

  if (source.paymentStatus === 'paid') {
    return `Don ${code} da thanh toan thanh cong qua ${methodLabel}.`
  }

  if (expired) {
    return `Don ${code} da het han thanh toan. He thong chua ghi nhan thanh toan hop le trong thoi gian cho thanh toan.`
  }

  if (source.paymentStatus === 'failed' || source.status === 'cancelled') {
    return `Don ${code} khong con o trang thai cho thanh toan. Trang thai hien tai: ${PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus}.`
  }

  if (source.paymentStatus === 'pending') {
    if (source.paymentMethod === 'sepay') {
      return `Don ${code} chua ghi nhan thanh toan Sepay. Vui long kiem tra dung so tien va noi dung chuyen khoan ${getOrderPaymentReference(source)}.`
    }

    if (PLACE_ORDER_PAYMENT_METHODS.includes(source.paymentMethod)) {
      return `Don ${code} dang cho thanh toan qua ${methodLabel}. Co the dung resumePayment de lay lai link thanh toan neu can.`
    }
  }

  return `Trang thai thanh toan cua don ${code}: ${PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus || 'khong ro'}.`
}

function buildPaymentStatusPayload(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const effectivePaymentStatus = expired ? 'expired' : source.paymentStatus
  const paymentReference = getOrderPaymentReference(source)
  const canResumePayment = !expired && isPendingPayableOrder(source)

  return {
    found: true,
    paid: source.paymentStatus === 'paid',
    pending: source.paymentStatus === 'pending' && !expired,
    failed: source.paymentStatus === 'failed' || source.status === 'cancelled',
    expired,
    paymentStatus: source.paymentStatus,
    effectivePaymentStatus,
    paymentStatusLabel: expired
      ? 'Het han thanh toan'
      : (PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus),
    paymentMethod: source.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[source.paymentMethod] || source.paymentMethod,
    transactionId: source.paymentTransactionId || null,
    paymentReference,
    canResumePayment,
    canVerifyBankTransfer: source.paymentMethod === 'sepay',
    suggestedTool: canResumePayment
      ? (source.paymentMethod === 'sepay' ? 'getBankInfo' : 'resumePayment')
      : null,
    order: {
      ...buildPaymentStatusSelectionPayload(source),
      expectedTransferContent: source.paymentMethod === 'sepay' ? paymentReference : null
    },
    message: getPaymentStatusMessage(source, { expired })
  }
}

async function resolveGuestOrderForPaymentStatus({ orderId, orderCode, phone } = {}) {
  const lookup = normalizeOrderLookupValue({ orderId, orderCode })
  const normalizedPhone = normalizePhone(phone)

  if (!lookup) {
    return {
      error: {
        found: false,
        message: 'Vui long cung cap ma don hang can kiem tra thanh toan.'
      }
    }
  }

  if (!normalizedPhone) {
    return {
      error: {
        found: false,
        requiresPhone: true,
        message: 'Khach chua dang nhap can cung cap so dien thoai dat hang de kiem tra trang thai thanh toan.'
      }
    }
  }

  let order = null

  if (isMongoObjectId(lookup)) {
    order = await orderRepository.findOne({
      _id: lookup,
      'contact.phone': normalizedPhone,
      isDeleted: false
    })
  }

  if (!order) {
    order = await orderRepository.findOne({
      orderCode: { $regex: `^${escapeRegExp(lookup)}$`, $options: 'i' },
      'contact.phone': normalizedPhone,
      isDeleted: false
    })
  }

  if (!order) {
    return {
      error: {
        found: false,
        message: 'Khong tim thay don hang khop voi ma don va so dien thoai.'
      }
    }
  }

  return { order }
}

async function closeExpiredPaymentIfNeeded(order) {
  if (!order || order.paymentStatus !== 'pending' || !paymentService.isPaymentWindowExpired(order)) {
    return false
  }

  await paymentService.closeExpiredPaymentOrder(order)
  return true
}

function normalizeBankTransferLookup({ orderCode, paymentReference } = {}) {
  return cleanString(paymentReference || orderCode).replace(/^#/, '')
}

async function findOrderByBankTransferLookup({ orderCode, paymentReference } = {}) {
  const lookup = normalizeBankTransferLookup({ orderCode, paymentReference })
  if (!lookup) return null

  if (isMongoObjectId(lookup)) {
    const order = await orderRepository.findByIdNotDeleted(lookup)
    if (order) return order
  }

  return orderRepository.findOne({
    orderCode: { $regex: `^${escapeRegExp(lookup)}$`, $options: 'i' },
    isDeleted: false
  })
}

function canExposeBankTransferOrder(order = {}, userId = null) {
  const source = getOrderObject(order)
  if (!isMongoObjectId(userId) || !source.userId) return true
  return source.userId.toString() === userId.toString()
}

function getBankTransferVerificationMessage(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const code = formatOrderCode(source)

  if (source.paymentStatus === 'paid') {
    return `He thong da ghi nhan thanh toan cho don ${code}.`
  }

  if (expired) {
    return `Don ${code} da het han thanh toan. He thong chua ghi nhan chuyen khoan hop le trong thoi gian thanh toan.`
  }

  if (source.paymentStatus === 'failed' || source.status === 'cancelled') {
    return `Don ${code} khong con o trang thai cho thanh toan.`
  }

  if (source.paymentMethod !== 'sepay') {
    return `Don ${code} dang dung phuong thuc thanh toan ${source.paymentMethod}; trang thai hien tai la ${PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus}.`
  }

  return `He thong chua ghi nhan chuyen khoan khop voi don ${code}. Vui long kiem tra dung so tien va noi dung chuyen khoan.`
}

function buildBankTransferVerificationPayload(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const effectivePaymentStatus = expired ? 'expired' : source.paymentStatus
  const paymentReference = getOrderPaymentReference(source)

  return {
    found: true,
    verified: source.paymentStatus === 'paid',
    paid: source.paymentStatus === 'paid',
    pending: source.paymentStatus === 'pending' && !expired,
    expired,
    paymentStatus: source.paymentStatus,
    effectivePaymentStatus,
    paymentStatusLabel: expired
      ? 'Het han thanh toan'
      : (PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus),
    order: {
      id: source._id?.toString?.() || null,
      orderCode: cleanString(source.orderCode) || null,
      code: formatOrderCode(source),
      status: source.status,
      statusLabel: ORDER_STATUS_LABELS[source.status] || source.status,
      paymentMethod: source.paymentMethod,
      total: Number(source.total || 0),
      totalFormatted: formatPrice(source.total),
      paymentReference,
      expectedTransferContent: paymentReference,
      transactionId: source.paymentTransactionId || null,
      expiresAt: source.reservationExpiresAt || null,
      updatedAt: source.updatedAt || null,
      orderUrl: source._id ? `${CLIENT_URL}/orders/${source._id.toString()}` : null
    },
    message: getBankTransferVerificationMessage(source, { expired })
  }
}

function normalizePaymentProofAttachmentUrls(args = {}) {
  const rawValues = []
  const append = value => {
    if (Array.isArray(value)) {
      value.forEach(append)
      return
    }

    if (typeof value === 'string' && /[\n,]/.test(value)) {
      value.split(/[\n,]+/).forEach(append)
      return
    }

    const url = cleanString(value)
    if (url) rawValues.push(url)
  }

  append(args.proofImageUrls)
  append(args.proofImageUrl)
  append(args.proofUrls)
  append(args.proofUrl)
  append(args.receiptUrls)
  append(args.receiptUrl)
  append(args.attachmentUrls)
  append(args.attachmentUrl)
  append(args.imageUrls)
  append(args.imageUrl)

  return [...new Set(rawValues)].slice(0, 10)
}

function normalizePaymentProofAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null
}

function hasPaymentProofEvidence(args = {}, attachmentUrls = []) {
  return attachmentUrls.length > 0
    || !!cleanString(args.transactionId || args.referenceCode || args.bankTransactionId)
    || !!cleanString(args.transferTime || args.paidAt)
    || normalizePaymentProofAmount(args.paidAmount || args.amount) !== null
    || cleanString(args.note || args.details || args.message).length >= 10
}

function buildPaymentProofOrderLookup(args = {}) {
  const paymentReference = cleanString(args.paymentReference || args.transferContent)
  return {
    orderId: cleanString(args.orderId) || (isMongoObjectId(paymentReference) ? paymentReference : ''),
    orderCode: cleanString(args.orderCode || args.code) || (!isMongoObjectId(paymentReference) ? paymentReference : ''),
    paymentReference
  }
}

async function findOrderByPaymentProofLookup(args = {}) {
  const { orderId, orderCode, paymentReference } = buildPaymentProofOrderLookup(args)
  const lookup = normalizeOrderLookupValue({ orderId, orderCode: orderCode || paymentReference })
  if (!lookup) return null

  if (isMongoObjectId(lookup)) {
    const order = await orderRepository.findByIdNotDeleted(lookup)
    if (order) return order
  }

  return orderRepository.findOne({
    orderCode: { $regex: `^${escapeRegExp(lookup)}$`, $options: 'i' },
    isDeleted: false
  })
}

function paymentProofContactMatchesOrder(order = {}, { phone = '', email = '' } = {}) {
  const source = getOrderObject(order)
  const orderPhone = normalizePhone(source.contact?.phone)
  const orderEmail = cleanString(source.contact?.email).toLowerCase()

  return !!(
    (phone && orderPhone && phone === orderPhone)
    || (email && orderEmail && email === orderEmail)
  )
}

async function resolveOrderForPaymentProof(args = {}, context = {}) {
  const userId = normalizeUserId(context)
  const { orderId, orderCode, paymentReference } = buildPaymentProofOrderLookup(args)

  if (isMongoObjectId(userId)) {
    const resolved = await resolveOwnedOrderForPayment({
      userId,
      orderId,
      orderCode: orderCode || paymentReference
    })

    if (resolved.error) return { error: { success: false, ...resolved.error } }
    return { order: resolved.order }
  }

  if (!cleanString(orderId || orderCode || paymentReference)) {
    return {
      error: {
        success: false,
        requiresOrderCode: true,
        message: 'Vui long cung cap ma don hang hoac paymentReference tren noi dung chuyen khoan.'
      }
    }
  }

  const phone = normalizePhone(args.phone || context.customerInfo?.phone)
  const email = cleanString(args.email || context.customerInfo?.email).toLowerCase()
  if (!phone && !email) {
    return {
      error: {
        success: false,
        requiresContactInfo: true,
        message: 'Khach chua dang nhap can cung cap so dien thoai hoac email dat hang de gui chung tu thanh toan.'
      }
    }
  }

  const order = await findOrderByPaymentProofLookup({ orderId, orderCode, paymentReference })
  if (!order) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Khong tim thay don hang khop voi ma don/paymentReference.'
      }
    }
  }

  if (!paymentProofContactMatchesOrder(order, { phone, email })) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Thong tin lien he khong khop voi don hang can gui chung tu.'
      }
    }
  }

  return { order }
}

async function getPaymentProofContact(args = {}, order = {}, context = {}) {
  const source = getOrderObject(order)
  const customerInfo = context.customerInfo || {}
  const userId = normalizeUserId(context)
  const user = isMongoObjectId(userId)
    ? await userRepository.findById(userId, {
        select: 'username fullName email phone',
        lean: true
      })
    : null

  return {
    name: pickString(
      args.name,
      args.fullName,
      customerInfo.name,
      source.contact?.firstName && source.contact?.lastName
        ? `${source.contact.firstName} ${source.contact.lastName}`
        : '',
      user?.fullName,
      user?.username
    ),
    email: pickString(args.email, customerInfo.email, source.contact?.email, user?.email).toLowerCase(),
    phone: normalizePhone(pickString(args.phone, customerInfo.phone, source.contact?.phone, user?.phone)),
    preferredContactMethod: cleanString(args.preferredContactMethod || args.contactMethod)
      || (pickString(args.email, customerInfo.email, source.contact?.email, user?.email) ? 'email' : 'phone')
  }
}

function buildPaymentProofMessage({ args = {}, order = {}, attachmentUrls = [], context = {} } = {}) {
  const source = getOrderObject(order)
  const paidAmount = normalizePaymentProofAmount(args.paidAmount || args.amount)
  const transactionId = cleanString(args.transactionId || args.referenceCode || args.bankTransactionId)
  const transferTime = cleanString(args.transferTime || args.paidAt)
  const note = cleanString(args.note || args.details || args.message)
  const paymentReference = cleanString(args.paymentReference || args.transferContent) || getOrderPaymentReference(source)

  return [
    'Loai yeu cau: Doi soat chung tu thanh toan/chuyen khoan',
    `Don hang: ${formatOrderCode(source)}`,
    `OrderId: ${serializeId(source._id || source.id)}`,
    `OrderCode: ${cleanString(source.orderCode) || '(khong co)'}`,
    `Phuong thuc thanh toan: ${source.paymentMethod || '(khong ro)'}`,
    `Trang thai don: ${source.status || '(khong ro)'} / thanh toan: ${source.paymentStatus || '(khong ro)'}`,
    `So tien don hang: ${formatPrice(source.total || 0)}`,
    `PaymentReference/noi dung chuyen khoan mong doi: ${paymentReference || '(khong co)'}`,
    paidAmount !== null ? `So tien khach bao da chuyen: ${formatPrice(paidAmount)}` : null,
    transactionId ? `Ma giao dich tren bien lai: ${transactionId}` : null,
    transferTime ? `Thoi gian chuyen khoan: ${transferTime}` : null,
    cleanString(args.senderBank) ? `Ngan hang nguoi chuyen: ${cleanString(args.senderBank)}` : null,
    cleanString(args.senderAccount) ? `Tai khoan nguoi chuyen: ${cleanString(args.senderAccount)}` : null,
    attachmentUrls.length > 0 ? `Chung tu/anh bien lai: ${attachmentUrls.join(' | ')}` : null,
    note ? `Ghi chu cua khach: ${note}` : null,
    cleanString(context.promptText) ? `Noi dung chat gan nhat: ${cleanString(context.promptText)}` : null,
    '',
    'Luu y: Ticket nay chi de nhan vien doi soat thu cong. Chatbot khong tu dong cap nhat paymentStatus.'
  ].filter(line => line !== null).join('\n')
}

function buildPaymentProofResponse(result = {}, args = {}, meta = {}) {
  const request = result.request || {}
  const ticketId = result.ticketId || request.ticketId || null
  const order = getOrderObject(meta.order)
  const paidAmount = normalizePaymentProofAmount(args.paidAmount || args.amount)

  return {
    ...result,
    success: true,
    ticketCreated: true,
    paymentProofSubmitted: true,
    paymentVerified: false,
    paymentStatusChanged: false,
    handoffRequested: false,
    escalate: false,
    ticketId,
    ticket: {
      ticketId,
      category: request.category || 'payment',
      priority: request.priority || 'high',
      subject: request.subject || meta.subject || null,
      preferredContactMethod: request.preferredContactMethod || meta.contact?.preferredContactMethod || null,
      createdAt: request.createdAt || null
    },
    proof: {
      attachmentUrls: meta.attachmentUrls || [],
      transactionId: cleanString(args.transactionId || args.referenceCode || args.bankTransactionId) || null,
      paidAmount,
      paidAmountFormatted: paidAmount !== null ? formatPrice(paidAmount) : null,
      transferTime: cleanString(args.transferTime || args.paidAt) || null,
      senderBank: cleanString(args.senderBank) || null,
      senderAccount: cleanString(args.senderAccount) || null
    },
    order: {
      id: serializeId(order._id || order.id),
      orderCode: cleanString(order.orderCode) || null,
      code: formatOrderCode(order),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentStatusLabel: PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
      status: order.status,
      total: Number(order.total || 0),
      totalFormatted: formatPrice(order.total || 0),
      paymentReference: getOrderPaymentReference(order),
      orderUrl: order._id ? `${CLIENT_URL}/orders/${order._id.toString()}` : null
    },
    message: `Minh da gui chung tu thanh toan${ticketId ? ` ${ticketId}` : ''} cho nhan vien doi soat. Trang thai thanh toan chua duoc xac nhan tu dong; nhan vien se kiem tra va phan hoi.`,
    nextAction: 'manual_payment_review'
  }
}

async function checkPaymentStatus({ orderId, orderCode, phone } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    const hasLookup = !!cleanString(orderId || orderCode)
    let order = null

    if (isMongoObjectId(userId)) {
      if (!hasLookup) {
        const result = await ordersService.getMyOrders(userId)
        const orders = Array.isArray(result?.orders) ? result.orders.slice(0, 5) : []

        return JSON.stringify({
          found: orders.length > 0,
          requiresOrderSelection: true,
          message: orders.length > 0
            ? 'Vui long chon ma don hang can kiem tra trang thai thanh toan.'
            : 'Tai khoan dang chat chua co don hang nao de kiem tra.',
          orders: orders.map(buildPaymentStatusSelectionPayload)
        })
      }

      const resolved = await resolveOwnedOrderForPayment({ userId, orderId, orderCode })
      if (resolved.error) return JSON.stringify(resolved.error)
      order = resolved.order
    } else {
      const resolved = await resolveGuestOrderForPaymentStatus({ orderId, orderCode, phone })
      if (resolved.error) return JSON.stringify(resolved.error)
      order = resolved.order
    }

    const expired = await closeExpiredPaymentIfNeeded(order)
    return JSON.stringify(buildPaymentStatusPayload(order, { expired }))
  } catch (err) {
    logger.error('[AI Tool] checkPaymentStatus error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the kiem tra trang thai thanh toan.',
      error: 'Loi khi kiem tra trang thai thanh toan.'
    })
  }
}

async function resumePayment({ orderId, orderCode, paymentMethod } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de lay lai link thanh toan cua don hang.'
      })
    }

    const { order, error } = await resolveOwnedOrderForPayment({ userId, orderId, orderCode })
    if (error) return JSON.stringify(error)

    const paymentCheckError = await ensureOrderCanResumePayment(order)
    if (paymentCheckError) return JSON.stringify(paymentCheckError)

    const requestedMethod = normalizePaymentToolMethod(paymentMethod)
    if (cleanString(paymentMethod) && !requestedMethod) {
      return JSON.stringify({
        success: false,
        message: 'Phuong thuc thanh toan khong hop le. Chi ho tro VNPay, MoMo, ZaloPay hoac Sepay.'
      })
    }

    const selectedMethod = requestedMethod || order.paymentMethod
    if (selectedMethod !== order.paymentMethod) {
      return JSON.stringify({
        success: false,
        methodMismatch: true,
        orderPaymentMethod: order.paymentMethod,
        requestedPaymentMethod: selectedMethod,
        message: 'Phuong thuc thanh toan yeu cau khong khop voi don hang. Vui long tao don moi neu muon doi cong thanh toan.',
        order: buildPendingPaymentOrderPreview(order)
      })
    }

    const paymentReference = getOrderPaymentReference(order)
    const payment = await createOnlinePaymentRequest(
      selectedMethod,
      order._id.toString(),
      userId,
      paymentReference
    )

    if (selectedMethod === 'sepay') {
      payment.bankInfo = await getActiveBankInfoPayload({ order, paymentReference })
    }

    return JSON.stringify({
      success: true,
      requiresPayment: true,
      message: selectedMethod === 'sepay'
        ? 'Da lay lai thong tin thanh toan Sepay. Vui long chuyen khoan dung so tien va noi dung thanh toan.'
        : 'Da tao lai link thanh toan. Vui long mo link de hoan tat don hang.',
      order: buildPendingPaymentOrderPreview(order),
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] resumePayment error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the tao lai link thanh toan.',
      error: 'Loi khi tao lai thanh toan.'
    })
  }
}

async function updatePendingOrderPaymentMethod(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de doi cong thanh toan cua don pending.'
      })
    }

    const selectedPaymentMethod = normalizePaymentToolMethod(args.paymentMethod)
    if (!selectedPaymentMethod) {
      return JSON.stringify({
        success: false,
        message: 'Phuong thuc thanh toan moi khong hop le. Chi ho tro VNPay, MoMo, ZaloPay hoac Sepay.'
      })
    }

    const { order, error } = await resolveOwnedOrderForPayment({
      userId,
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (error) return JSON.stringify(error)

    const paymentCheckError = await ensureOrderCanResumePayment(order)
    if (paymentCheckError) return JSON.stringify(paymentCheckError)

    const result = await ordersService.updatePendingOrderPaymentMethod(
      userId,
      order._id.toString(),
      selectedPaymentMethod
    )
    const updatedOrder = result.order
    const paymentReference = getOrderPaymentReference(updatedOrder)
    const payment = await createOnlinePaymentRequest(
      selectedPaymentMethod,
      updatedOrder._id.toString(),
      userId,
      paymentReference
    )

    if (selectedPaymentMethod === 'sepay') {
      payment.bankInfo = await getActiveBankInfoPayload({ order: updatedOrder, paymentReference })
    }

    return JSON.stringify({
      success: true,
      requiresPayment: true,
      paymentMethodChanged: result.paymentMethodChanged,
      previousPaymentMethod: result.previousPaymentMethod,
      paymentMethod: selectedPaymentMethod,
      message: selectedPaymentMethod === 'sepay'
        ? 'Da doi cong thanh toan sang Sepay. Vui long chuyen khoan dung so tien va noi dung thanh toan moi.'
        : 'Da doi cong thanh toan va tao link thanh toan moi. Vui long dung link moi de hoan tat don.',
      order: buildPendingPaymentOrderPreview(updatedOrder),
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] updatePendingOrderPaymentMethod error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the doi cong thanh toan cua don pending.',
      error: 'Loi khi doi cong thanh toan don pending.'
    })
  }
}

async function getBankInfo({ orderId, orderCode, paymentReference, amount } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    let order = null
    let orderLookupError = null

    if (cleanString(orderId || orderCode)) {
      if (isMongoObjectId(userId)) {
        const resolved = await resolveOwnedOrderForPayment({ userId, orderId, orderCode })
        order = resolved.order || null
        orderLookupError = resolved.error || null
      } else {
        orderLookupError = {
          requiresLogin: true,
          message: 'Can dang nhap de lay so tien va noi dung chuyen khoan theo don hang.'
        }
      }
    }

    const bankInfo = await getActiveBankInfoPayload({
      order,
      paymentReference,
      amount
    })

    return JSON.stringify({
      found: true,
      bankInfo,
      orderLookupError,
      message: bankInfo.paymentReference
        ? 'Khi chuyen khoan cho don nay, noi dung chuyen khoan can dung dung ma paymentReference.'
        : 'Day la thong tin tai khoan chuyen khoan hien tai cua cua hang.'
    })
  } catch (err) {
    logger.error('[AI Tool] getBankInfo error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong tim thay thong tin chuyen khoan dang active.',
      error: 'Loi khi lay thong tin chuyen khoan.'
    })
  }
}

async function verifyBankTransfer({ orderCode, paymentReference } = {}, context = {}) {
  try {
    const lookup = normalizeBankTransferLookup({ orderCode, paymentReference })
    if (!lookup) {
      return JSON.stringify({
        found: false,
        message: 'Vui long cung cap orderCode hoac paymentReference de kiem tra chuyen khoan.'
      })
    }

    const order = await findOrderByBankTransferLookup({ orderCode, paymentReference })
    if (!order) {
      return JSON.stringify({
        found: false,
        message: `Khong tim thay don hang voi ma thanh toan "${lookup}".`
      })
    }

    const userId = normalizeUserId(context)
    if (!canExposeBankTransferOrder(order, userId)) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay don hang voi ma thanh toan nay trong tai khoan dang chat.'
      })
    }

    const expired = order.paymentStatus === 'pending' && paymentService.isPaymentWindowExpired(order)

    return JSON.stringify(buildBankTransferVerificationPayload(order, { expired }))
  } catch (err) {
    logger.error('[AI Tool] verifyBankTransfer error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the kiem tra trang thai chuyen khoan.',
      error: 'Loi khi kiem tra chuyen khoan.'
    })
  }
}

async function submitPaymentProof(args = {}, context = {}) {
  try {
    const attachmentUrls = normalizePaymentProofAttachmentUrls(args)
    if (!hasPaymentProofEvidence(args, attachmentUrls)) {
      return JSON.stringify({
        success: false,
        requiresProof: true,
        message: 'Vui long gui anh/link bien lai hoac thong tin giao dich nhu ma giao dich, so tien, thoi gian chuyen khoan.'
      })
    }

    const { order, error } = await resolveOrderForPaymentProof(args, context)
    if (error) return JSON.stringify(error)

    if (order.paymentStatus === 'paid') {
      return JSON.stringify({
        success: true,
        paymentProofSubmitted: false,
        alreadyPaid: true,
        paymentVerified: true,
        order: buildPaymentStatusSelectionPayload(order),
        message: `Don ${formatOrderCode(order)} da duoc he thong ghi nhan thanh toan, khong can gui them chung tu.`
      })
    }

    const contactService = require('../../client/cms/contact.service')
    const contact = await getPaymentProofContact(args, order, context)
    const subject = truncateHandoffText(
      `[Chung tu thanh toan] ${formatOrderCode(order)} - ${getOrderPaymentReference(order)}`,
      180
    )
    const result = await contactService.submitContactRequest({
      ...contact,
      category: 'payment',
      priority: 'high',
      subject,
      message: buildPaymentProofMessage({ args, order, attachmentUrls, context }),
      currentPage: cleanString(args.currentPage || context.customerInfo?.currentPage),
      source: 'chatbot_payment_proof'
    }, {
      ...context,
      source: 'chatbot_payment_proof'
    })

    return JSON.stringify(buildPaymentProofResponse(result, args, {
      order,
      contact,
      subject,
      attachmentUrls
    }))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] submitPaymentProof validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        paymentProofSubmitted: false,
        paymentVerified: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'PAYMENT_PROOF_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] submitPaymentProof error:', err.message)
    return JSON.stringify({
      success: false,
      ticketCreated: false,
      paymentProofSubmitted: false,
      paymentVerified: false,
      message: 'Minh chua gui duoc chung tu thanh toan luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
      error: 'PAYMENT_PROOF_SUBMIT_FAILED'
    })
  }
}

module.exports = {
  checkPaymentStatus,
  resumePayment,
  updatePendingOrderPaymentMethod,
  getBankInfo,
  verifyBankTransfer,
  submitPaymentProof
}












