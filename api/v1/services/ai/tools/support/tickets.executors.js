const {
  agentToolCallRepository,
  cleanString,
  isMongoObjectId,
  logger,
  normalizeUserId,
  parseToolPayload,
  serializeDate,
  SUPPORT_REQUEST_SOURCE_META,
  SUPPORT_REQUEST_SOURCE_TOOLS,
  SUPPORT_REQUEST_TYPE_TOOLS,
  SUPPORT_TICKET_LOOKUP_SOURCE_TOOLS,
  SUPPORT_TICKET_SOURCE_META,
  truncateHandoffText,
  buildSupportTicketResponse,
  normalizeSupportRequestType,
  normalizeSupportTicketId,
  extractSupportTicketPayload,
  normalizeSupportTicketUrlList,
  normalizeSupportTicketStatus,
  getSupportTicketStatusLabel,
  isSupportTicketLookupVerified,
  findSupportTicketLog,
  findSupportTicketUpdateLogs,
  buildSupportTicketStatusResponse,
  addSupportTicketUpdatesToStatusResponse,
  buildSupportRequestListItem,
  isSupportTicketAlreadyCancelled,
  canCancelSupportTicketStatus,
  buildCancelledSupportTicketPayload,
  getSupportTicketContactValue
} = require('./support.helpers')

async function createSupportTicket(args = {}, context = {}) {
  try {
    const contactService = require('../../../client/contact.service')
    const result = await contactService.submitContactRequest(args, {
      ...context,
      source: 'chatbot_ticket'
    })

    return JSON.stringify(buildSupportTicketResponse(result, args))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] createSupportTicket validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        handoffRequested: false,
        escalate: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'SUPPORT_TICKET_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] createSupportTicket error:', err.message)

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      handoffRequested: false,
      escalate: false,
      message: 'Minh chua tao duoc ticket ho tro luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'SUPPORT_TICKET_CREATE_FAILED'
    })
  }
}

async function updateSupportTicket(args = {}, context = {}) {
  return addSupportTicketMessage(args, context)
}

async function listMySupportTickets({ type = 'all', limit = 5 } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    const sessionId = cleanString(context.sessionId)
    const ownershipFilters = []

    if (isMongoObjectId(userId)) ownershipFilters.push({ userId })
    if (sessionId) ownershipFilters.push({ sessionId })

    if (ownershipFilters.length === 0) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap hoac co phien chat hien tai de xem cac yeu cau ho tro gan day.'
      })
    }

    const normalizedType = normalizeSupportRequestType(type)
    const normalizedLimit = Math.min(Math.max(Number(limit) || 5, 1), 10)
    const fetchLimit = Math.min(Math.max(normalizedLimit * 4, 20), 50)
    const filter = {
      toolName: { $in: SUPPORT_REQUEST_TYPE_TOOLS[normalizedType] || SUPPORT_REQUEST_SOURCE_TOOLS }
    }

    if (ownershipFilters.length === 1) {
      Object.assign(filter, ownershipFilters[0])
    } else {
      filter.$or = ownershipFilters
    }

    const logs = await agentToolCallRepository.findByQuery(filter, {
      sort: { createdAt: -1, _id: -1 },
      limit: fetchLimit,
      lean: true
    })
    const tickets = logs
      .map(buildSupportRequestListItem)
      .filter(Boolean)
      .slice(0, normalizedLimit)

    return JSON.stringify({
      success: true,
      found: tickets.length > 0,
      count: tickets.length,
      type: normalizedType,
      scope: isMongoObjectId(userId) ? 'account_or_session' : 'session',
      message: tickets.length > 0
        ? null
        : 'Chua tim thay yeu cau ho tro gan day cho tai khoan hoac phien chat nay.',
      tickets
    })
  } catch (err) {
    logger.error('[AI Tool] listMySupportTickets error:', err.message)

    return JSON.stringify({
      success: false,
      found: false,
      message: 'Khong the lay danh sach yeu cau ho tro luc nay.',
      error: 'SUPPORT_TICKET_LIST_FAILED'
    })
  }
}

async function cancelSupportTicket(args = {}, context = {}) {
  try {
    const ticketId = normalizeSupportTicketId(args.ticketId || args.ticketCode || args.id)

    if (!ticketId) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresTicketId: true,
        message: 'Vui long cung cap ma ticket ho tro can huy.',
        nextAction: 'ask_for_ticket_id'
      })
    }

    const log = await findSupportTicketLog(ticketId, SUPPORT_TICKET_LOOKUP_SOURCE_TOOLS)

    if (!log) {
      return JSON.stringify({
        success: false,
        found: false,
        ticketId,
        message: 'Khong tim thay ticket nay trong cac yeu cau ho tro chatbot da ghi nhan. Vui long kiem tra lai ma ticket hoac lien he nhan vien ho tro.',
        nextAction: 'ask_ticket_id_or_contact_support'
      })
    }

    const payload = parseToolPayload(log.resultPayload) || {}
    const ticket = extractSupportTicketPayload(payload, ticketId)
    const status = normalizeSupportTicketStatus(payload)
    const statusLabel = getSupportTicketStatusLabel(status)
    const sourceMeta = SUPPORT_REQUEST_SOURCE_META[log.toolName] || SUPPORT_TICKET_SOURCE_META[log.toolName] || {
      type: 'support_ticket',
      label: 'Ticket ho tro'
    }
    const verified = isSupportTicketLookupVerified(log, args, context, payload)

    if (!verified) {
      return JSON.stringify({
        success: false,
        found: true,
        ticketId: ticket.ticketId || ticketId,
        requiresVerification: true,
        detailsRestricted: true,
        message: 'Can dang nhap dung tai khoan/phien chat da tao ticket hoac cung cap email/so dien thoai cua ticket de xac minh truoc khi huy.',
        nextAction: 'ask_for_ticket_contact_verification'
      })
    }

    if (isSupportTicketAlreadyCancelled(status)) {
      return JSON.stringify({
        success: true,
        found: true,
        cancelled: true,
        alreadyCancelled: true,
        ticketId: ticket.ticketId || ticketId,
        status: 'cancelled',
        statusLabel: getSupportTicketStatusLabel('cancelled'),
        ticketType: sourceMeta.type,
        ticketTypeLabel: sourceMeta.label,
        cancellation: payload.cancellation || null,
        message: `Ticket ${ticket.ticketId || ticketId} da duoc ghi nhan huy truoc do.`,
        nextAction: 'support_ticket_cancelled'
      })
    }

    if (!canCancelSupportTicketStatus(status)) {
      return JSON.stringify({
        success: false,
        found: true,
        canCancel: false,
        ticketId: ticket.ticketId || ticketId,
        status,
        statusLabel,
        ticketType: sourceMeta.type,
        ticketTypeLabel: sourceMeta.label,
        message: `Ticket ${ticket.ticketId || ticketId} dang o trang thai ${statusLabel}, chatbot khong the huy truc tiep.`,
        nextAction: 'contact_support_if_needed'
      })
    }

    const reason = truncateHandoffText(args.reason || args.cancelReason || args.details || context.promptText, 240)
    const cancelledAt = new Date().toISOString()
    const updatedPayload = buildCancelledSupportTicketPayload(payload, {
      ticketId: ticket.ticketId || ticketId,
      previousStatus: status,
      reason,
      cancelledAt,
      context
    })
    const updatedLog = await agentToolCallRepository.updateById(log._id, {
      resultPayload: JSON.stringify(updatedPayload),
      resultPreview: `Da huy ticket ${ticket.ticketId || ticketId} theo yeu cau cua khach.`,
      outcome: 'success'
    }, { lean: true })

    if (!updatedLog) {
      return JSON.stringify({
        success: false,
        found: true,
        ticketId: ticket.ticketId || ticketId,
        message: 'Khong the cap nhat trang thai huy ticket luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
        error: 'SUPPORT_TICKET_CANCEL_UPDATE_FAILED'
      })
    }

    return JSON.stringify({
      success: true,
      found: true,
      cancelled: true,
      ticketId: ticket.ticketId || ticketId,
      status: 'cancelled',
      statusLabel: getSupportTicketStatusLabel('cancelled'),
      previousStatus: status,
      previousStatusLabel: statusLabel,
      ticketType: sourceMeta.type,
      ticketTypeLabel: sourceMeta.label,
      ticket: {
        ticketId: ticket.ticketId || ticketId,
        category: ticket.category || null,
        priority: ticket.priority || null,
        subject: ticket.subject || null,
        createdAt: ticket.createdAt || serializeDate(log.createdAt)
      },
      cancellation: updatedPayload.cancellation,
      message: `Da ghi nhan huy ticket ${ticket.ticketId || ticketId}. Neu nhan vien da bat dau xu ly, ho co the lien he de xac nhan them.`,
      nextAction: 'support_ticket_cancelled'
    })
  } catch (err) {
    logger.error('[AI Tool] cancelSupportTicket error:', err.message)

    return JSON.stringify({
      success: false,
      cancelled: false,
      message: 'Minh chua huy duoc ticket luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
      error: 'SUPPORT_TICKET_CANCEL_FAILED'
    })
  }
}

async function getSupportTicketStatus(args = {}, context = {}) {
  try {
    const ticketId = normalizeSupportTicketId(args.ticketId || args.ticketCode || args.id)

    if (!ticketId) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresTicketId: true,
        message: 'Vui long cung cap ma ticket ho tro can tra cuu.',
        nextAction: 'ask_for_ticket_id'
      })
    }

    const log = await findSupportTicketLog(ticketId)

    if (!log) {
      return JSON.stringify({
        success: false,
        found: false,
        ticketId,
        message: 'Khong tim thay ticket nay trong cac ticket chatbot da ghi nhan. Vui long kiem tra lai ma ticket hoac lien he nhan vien ho tro.',
        nextAction: 'ask_ticket_id_or_contact_support'
      })
    }

    const payload = parseToolPayload(log.resultPayload) || {}
    const response = buildSupportTicketStatusResponse(log, payload, args, context, ticketId)
    const updateLogs = response.verified ? await findSupportTicketUpdateLogs(response.ticketId || ticketId) : []

    return JSON.stringify(addSupportTicketUpdatesToStatusResponse(response, updateLogs))
  } catch (err) {
    logger.error('[AI Tool] getSupportTicketStatus error:', err.message)

    return JSON.stringify({
      success: false,
      found: false,
      message: 'Minh chua tra cuu duoc trang thai ticket luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
      error: 'SUPPORT_TICKET_STATUS_LOOKUP_FAILED'
    })
  }
}

async function addSupportTicketMessage(args = {}, context = {}) {
  try {
    const ticketId = normalizeSupportTicketId(args.ticketId || args.ticketCode || args.id)

    if (!ticketId) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresTicketId: true,
        message: 'Vui long cung cap ma ticket ho tro can bo sung thong tin.',
        nextAction: 'ask_for_ticket_id'
      })
    }

    const updateMessage = truncateHandoffText(
      args.message || args.update || args.details || args.note || args.description || '',
      3000
    )
    const imageUrls = normalizeSupportTicketUrlList(
      args.imageUrls,
      args.screenshotUrls,
      args.mediaUrls,
      context.currentMessageImageUrls
    )
    const attachmentUrls = normalizeSupportTicketUrlList(
      args.attachmentUrls,
      args.fileUrls,
      args.files
    )
    const allAttachmentUrls = [...new Set([...imageUrls, ...attachmentUrls])]

    if (!updateMessage && allAttachmentUrls.length === 0) {
      return JSON.stringify({
        success: false,
        found: false,
        ticketId,
        requiresContent: true,
        message: 'Can co noi dung bo sung hoac anh/tep dinh kem de gui vao ticket.',
        nextAction: 'ask_for_ticket_update_content'
      })
    }

    const log = await findSupportTicketLog(ticketId, SUPPORT_TICKET_LOOKUP_SOURCE_TOOLS)

    if (!log) {
      return JSON.stringify({
        success: false,
        found: false,
        ticketId,
        message: 'Khong tim thay ticket nay trong cac yeu cau ho tro chatbot da ghi nhan. Vui long kiem tra lai ma ticket hoac lien he nhan vien ho tro.',
        nextAction: 'ask_ticket_id_or_contact_support'
      })
    }

    const payload = parseToolPayload(log.resultPayload) || {}
    const ticket = extractSupportTicketPayload(payload, ticketId)
    const verified = isSupportTicketLookupVerified(log, args, context, payload)

    if (!verified) {
      return JSON.stringify({
        success: false,
        found: true,
        ticketId: ticket.ticketId || ticketId,
        requiresVerification: true,
        detailsRestricted: true,
        message: 'Can dang nhap dung tai khoan/phien chat da tao ticket hoac cung cap email/so dien thoai cua ticket de xac minh truoc khi bo sung thong tin.',
        nextAction: 'ask_for_ticket_contact_verification'
      })
    }

    const sourceMeta = SUPPORT_REQUEST_SOURCE_META[log.toolName] || SUPPORT_TICKET_SOURCE_META[log.toolName] || {
      type: 'support_ticket',
      label: 'Ticket ho tro'
    }
    const contactService = require('../../../client/contact.service')
    const result = await contactService.addSupportTicketMessage({
      ticketId: ticket.ticketId || ticketId,
      subject: `Bo sung thong tin ticket ${ticket.ticketId || ticketId}`,
      message: updateMessage,
      imageUrls,
      attachmentUrls: allAttachmentUrls,
      name: getSupportTicketContactValue(log, payload, args, context, 'name'),
      email: getSupportTicketContactValue(log, payload, args, context, 'email'),
      phone: getSupportTicketContactValue(log, payload, args, context, 'phone'),
      currentPage: args.currentPage || context.customerInfo?.currentPage,
      source: 'chatbot_ticket_update'
    }, {
      ...context,
      source: 'chatbot_ticket_update'
    })

    return JSON.stringify({
      ...result,
      success: true,
      found: true,
      ticketUpdated: true,
      ticketId: ticket.ticketId || ticketId,
      ticketType: sourceMeta.type,
      ticketTypeLabel: sourceMeta.label,
      ticket: {
        ticketId: ticket.ticketId || ticketId,
        category: ticket.category || null,
        priority: ticket.priority || null,
        subject: ticket.subject || null,
        createdAt: ticket.createdAt || serializeDate(log.createdAt)
      },
      update: {
        ...(result.update || {}),
        ticketId: ticket.ticketId || ticketId,
        message: updateMessage || null,
        imageUrls,
        attachmentUrls: allAttachmentUrls,
        attachmentCount: allAttachmentUrls.length
      },
      message: `Minh da bo sung thong tin vao ticket ${ticket.ticketId || ticketId}. Nhan vien ho tro se xem phan cap nhat nay khi theo doi ticket.`,
      nextAction: 'support_ticket_updated'
    })
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] addSupportTicketMessage validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketUpdated: false,
        message: err.message,
        error: 'SUPPORT_TICKET_UPDATE_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] addSupportTicketMessage error:', err.message)

    return JSON.stringify({
      success: false,
      ticketUpdated: false,
      message: 'Minh chua bo sung duoc thong tin vao ticket luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
      error: 'SUPPORT_TICKET_UPDATE_FAILED'
    })
  }
}

module.exports = {
  createSupportTicket,
  updateSupportTicket,
  listMySupportTickets,
  cancelSupportTicket,
  getSupportTicketStatus,
  addSupportTicketMessage
}
