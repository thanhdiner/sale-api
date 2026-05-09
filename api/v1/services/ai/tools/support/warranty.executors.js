const {
  cleanString,
  formatOrderCode,
  logger,
  parseToolPayload,
  toPlainObject,
  truncateHandoffText,
  WARRANTY_RESOLUTION_LABELS,
  normalizeSupportTicketId,
  findSupportTicketLog,
  buildSupportTicketStatusResponse,
  normalizeWarrantyResolution,
  normalizeWarrantyMediaUrls,
  getWarrantyOrderLookup,
  resolveWarrantyOrder,
  buildWarrantyOrderItemPayload,
  selectWarrantyOrderItem,
  resolveWarrantyProduct,
  buildWarrantyStatusPayload,
  getWarrantyRequestContact,
  buildWarrantySupportMessage,
  normalizeHandoffPriority
} = require('./support.helpers')

async function getWarrantyStatus(args = {}, context = {}) {
  try {
    const ticketId = normalizeSupportTicketId(args.ticketId)
    if (ticketId && !getWarrantyOrderLookup(args)) {
      const log = await findSupportTicketLog(ticketId)
      if (!log) {
        return JSON.stringify({
          success: false,
          found: false,
          ticketId,
          message: 'Khong tim thay ticket bao hanh nay trong cac ticket chatbot da ghi nhan.'
        })
      }

      const payload = parseToolPayload(log.resultPayload) || {}
      return JSON.stringify({
        ...buildSupportTicketStatusResponse(log, payload, args, context, ticketId),
        warrantyTicket: log.toolName === 'requestWarrantySupport'
      })
    }

    const resolved = await resolveWarrantyOrder(args, context)
    if (resolved.error) return JSON.stringify(resolved.error)

    const selected = selectWarrantyOrderItem(resolved.order, args)
    if (selected.error) return JSON.stringify(selected.error)

    const product = await resolveWarrantyProduct(selected.item, args)

    return JSON.stringify(buildWarrantyStatusPayload(resolved.order, selected.item, product, {
      verifiedBy: resolved.verifiedBy
    }))
  } catch (err) {
    logger.error('[AI Tool] getWarrantyStatus error:', err.message)
    return JSON.stringify({
      success: false,
      found: false,
      message: err.message || 'Khong the kiem tra thong tin bao hanh luc nay.',
      error: 'WARRANTY_STATUS_LOOKUP_FAILED'
    })
  }
}

async function requestWarrantySupport(args = {}, context = {}) {
  try {
    const issueDescription = cleanString(args.issueDescription || args.description || args.reason || args.details)
    if (!issueDescription) {
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        warrantyRequestCreated: false,
        requiresDescription: true,
        message: 'Vui long cung cap mo ta loi/tinh trang san pham truoc khi tao yeu cau bao hanh.'
      })
    }

    const resolved = await resolveWarrantyOrder(args, context, { action: 'request' })
    if (resolved.error) return JSON.stringify(resolved.error)

    const selected = selectWarrantyOrderItem(resolved.order, args)
    if (selected.error) return JSON.stringify(selected.error)

    const product = await resolveWarrantyProduct(selected.item, args)
    const warrantyStatus = buildWarrantyStatusPayload(resolved.order, selected.item, product, {
      verifiedBy: resolved.verifiedBy
    })
    const requestedResolution = normalizeWarrantyResolution(args.requestedResolution || args.resolution)
    const mediaUrls = normalizeWarrantyMediaUrls(args.mediaUrls || args.mediaUrl || args.screenshotUrls || args.screenshots)
    const contact = getWarrantyRequestContact(args, resolved.order, context)
    const orderSource = toPlainObject(resolved.order)
    const code = orderSource.orderCode || formatOrderCode(orderSource) || cleanString(args.orderCode || args.orderId)
    const itemPayload = buildWarrantyOrderItemPayload(selected.item)
    const subject = truncateHandoffText(`[Bao hanh] Don ${code || 'khong ro'} - ${itemPayload.name}`, 180)
    const priority = normalizeHandoffPriority(args.priority || 'normal')
    const message = buildWarrantySupportMessage({
      args: { ...args, issueDescription },
      order: resolved.order,
      item: selected.item,
      warrantyStatus,
      requestedResolution,
      mediaUrls,
      context
    })

    const contactService = require('../../../client/cms/contact.service')
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      category: 'warranty',
      priority,
      preferredContactMethod: contact.preferredContactMethod || 'chat',
      currentPage: cleanString(args.currentPage || context.customerInfo?.currentPage),
      source: 'chatbot_warranty'
    }, {
      ...context,
      source: 'chatbot_warranty',
      userId: resolved.userId || context.userId || context.customerInfo?.userId || null
    })

    return JSON.stringify({
      success: true,
      ticketCreated: true,
      warrantyRequestCreated: true,
      ticketId: result.ticketId,
      ticket: {
        ticketId: result.ticketId || result.request?.ticketId || null,
        category: 'warranty',
        priority,
        subject,
        preferredContactMethod: result.request?.preferredContactMethod || contact.preferredContactMethod || 'chat',
        createdAt: result.request?.createdAt || null
      },
      verifiedBy: resolved.verifiedBy,
      requestedResolution,
      requestedResolutionLabel: WARRANTY_RESOLUTION_LABELS[requestedResolution] || requestedResolution,
      order: warrantyStatus.order,
      item: warrantyStatus.item,
      warranty: warrantyStatus.warranty,
      mediaUrls,
      handoffRequested: false,
      escalate: false,
      summary: subject,
      priority,
      message: `Minh da tao yeu cau bao hanh ${result.ticketId}. Nhan vien ho tro se kiem tra dieu kien bao hanh va phan hoi theo thong tin lien he ban da cung cap.`,
      nextAction: 'warranty_support_follow_up'
    })
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestWarrantySupport validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        warrantyRequestCreated: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'WARRANTY_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestWarrantySupport error:', err.message)
    return JSON.stringify({
      success: false,
      ticketCreated: false,
      warrantyRequestCreated: false,
      message: 'Minh chua tao duoc yeu cau bao hanh luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'WARRANTY_REQUEST_CREATE_FAILED'
    })
  }
}

module.exports = {
  getWarrantyStatus,
  requestWarrantySupport
}










