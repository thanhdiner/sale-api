const {
  buildOrderSummaryPayload,
  cleanString,
  formatOrderCode,
  logger,
  RETURN_REQUEST_TYPE_LABELS,
  toPlainObject,
  truncateHandoffText,
  normalizeReturnRequestType,
  normalizeReturnResolution,
  normalizeReturnRequestItems,
  getReturnRequestContact,
  resolveReturnRequestOrder,
  getReturnRequestWarnings,
  saveReturnRefundRequestStatus,
  getReturnRefundRecordPayload,
  buildReturnRefundStatusPayload,
  resolveRefundStatusOrder,
  buildReturnRequestMessage,
  normalizeHandoffPriority
} = require('./support.helpers')

async function getRefundStatus(args = {}, context = {}) {
  try {
    const resolved = await resolveRefundStatusOrder(args, context)
    if (resolved.error) return JSON.stringify(resolved.error)

    return JSON.stringify(buildReturnRefundStatusPayload(resolved.order, {
      verifiedBy: resolved.verifiedBy,
      ticketId: args.ticketId
    }))
  } catch (err) {
    logger.error('[AI Tool] getRefundStatus error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the kiem tra trang thai doi tra/hoan tien.',
      error: 'Loi khi kiem tra trang thai doi tra/hoan tien.'
    })
  }
}

async function requestReturnOrRefund(args = {}, context = {}) {
  try {
    const reason = cleanString(args.reason)
    if (!reason) {
      return JSON.stringify({
        success: false,
        message: 'Vui long cung cap ly do doi tra/hoan tien truoc khi tao yeu cau.'
      })
    }

    const resolved = await resolveReturnRequestOrder(args, context)
    if (resolved.error) return JSON.stringify(resolved.error)

    const order = resolved.order || {}
    const requestType = normalizeReturnRequestType(args.requestType || args.type || context.promptText)
    const preferredResolution = normalizeReturnResolution(args.preferredResolution, requestType)
    const items = normalizeReturnRequestItems(args.items)
    const warnings = getReturnRequestWarnings(order, requestType)
    const contact = getReturnRequestContact(args, order, context)
    const orderSource = toPlainObject(order)
    const code = orderSource.orderCode || formatOrderCode(orderSource) || cleanString(args.orderCode || args.orderId)
    const priority = normalizeHandoffPriority(args.priority || (requestType === 'refund' ? 'high' : 'normal'))
    const subject = `[${RETURN_REQUEST_TYPE_LABELS[requestType] || 'Doi tra/hoan tien'}] Don ${code || 'khong ro'}`
    const message = buildReturnRequestMessage({
      args,
      order,
      requestType,
      preferredResolution,
      items,
      warnings,
      context
    })

    const contactService = require('../../../client/contact.service')
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      priority,
      preferredContactMethod: contact.preferredContactMethod || 'chat',
      source: 'chatbot_return_refund'
    }, {
      ...context,
      source: 'chatbot_return_refund',
      userId: resolved.userId || context.userId || context.customerInfo?.userId || null
    })

    let savedReturnRefund = null
    try {
      savedReturnRefund = await saveReturnRefundRequestStatus(order, {
        result,
        requestType,
        preferredResolution,
        items,
        args,
        priority
      })
    } catch (saveErr) {
      logger.warn(`[AI Tool] requestReturnOrRefund status save failed: ${saveErr.message}`)
    }

    const latestOrderSource = toPlainObject(order)
    const escalationReason = truncateHandoffText(`Return/refund request ${result.ticketId}: ${subject}`, 500)

    return JSON.stringify({
      success: true,
      ticketCreated: true,
      returnRequestCreated: true,
      ticketId: result.ticketId,
      requestType,
      preferredResolution,
      verifiedBy: resolved.verifiedBy,
      warnings,
      order: latestOrderSource?._id || latestOrderSource?.id ? buildOrderSummaryPayload(latestOrderSource) : null,
      returnRefund: savedReturnRefund ? getReturnRefundRecordPayload(savedReturnRefund) : null,
      items,
      handoffRequested: true,
      escalate: true,
      escalationReason,
      reason: escalationReason,
      summary: subject,
      priority,
      message: `Minh da tao yeu cau ${RETURN_REQUEST_TYPE_LABELS[requestType] || 'doi tra/hoan tien'} ${result.ticketId}. Nhan vien se kiem tra don hang va phan hoi; day chua phai xac nhan phe duyet hoan tien.`,
      nextAction: 'support_follow_up'
    })
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestReturnOrRefund validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'RETURN_REFUND_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestReturnOrRefund error:', err.message)

    const fallbackReason = truncateHandoffText(
      `Return/refund request failed: ${cleanString(args.orderCode || args.orderId || context.promptText || 'Yeu cau doi tra/hoan tien')}`,
      500
    )

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      returnRequestCreated: false,
      handoffRequested: true,
      escalate: true,
      escalationReason: fallbackReason,
      reason: fallbackReason,
      summary: cleanString(args.reason || context.promptText, 180) || null,
      priority: args.priority || 'high',
      message: 'Minh chua tao duoc ticket doi tra/hoan tien luc nay, nhung da chuyen thong tin sang nhan vien ho tro trong chat.',
      nextAction: 'notify_support_agents',
      error: 'RETURN_REFUND_REQUEST_FAILED'
    })
  }
}

module.exports = {
  getRefundStatus,
  requestReturnOrRefund
}
