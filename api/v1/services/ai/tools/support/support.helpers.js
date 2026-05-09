/**
 * Shared helpers for support AI tool executors.
 */

const {
  agentToolCallRepository,
  BUG_ISSUE_CATEGORY_MAP,
  BUG_ISSUE_SEVERITIES,
  BUG_ISSUE_TYPE_LABELS,
  BUG_ISSUE_TYPES,
  buildOrderSummaryPayload,
  CALLBACK_CONTACT_METHODS,
  cleanString,
  CLIENT_URL,
  DEFAULT_CALLBACK_TIMEZONE,
  DEFAULT_HANDOFF_REASON,
  escapeRegExp,
  findProductByQuery,
  formatDate,
  formatOrderCode,
  formatPrice,
  getGuideLocalizedRoot,
  getGuideText,
  HANDOFF_CUSTOMER_MESSAGE,
  HANDOFF_PRIORITIES,
  isMongoObjectId,
  logger,
  normalizePhone,
  normalizePolicyLanguage,
  normalizeSearchText,
  normalizeUserId,
  orderRepository,
  ordersService,
  parseToolPayload,
  pickString,
  productRepository,
  resolveOwnOrderId,
  RETURN_REFUND_STATUS_LABELS,
  RETURN_REFUND_STATUSES,
  RETURN_REFUND_SUB_STATUS_LABELS,
  RETURN_REFUND_SUB_STATUSES,
  RETURN_REQUEST_TYPE_LABELS,
  RETURN_REQUEST_TYPES,
  RETURN_RESOLUTION_LABELS,
  RETURN_RESOLUTIONS,
  serializeDate,
  serializeId,
  STORE_SOCIAL_MEDIA_FIELDS,
  SUPPORT_REQUEST_SOURCE_META,
  SUPPORT_REQUEST_SOURCE_TOOLS,
  SUPPORT_REQUEST_TYPE_TOOLS,
  SUPPORT_TICKET_ALREADY_CANCELLED_STATUSES,
  SUPPORT_TICKET_LOOKUP_SOURCE_TOOLS,
  SUPPORT_TICKET_NON_CANCELLABLE_STATUSES,
  SUPPORT_TICKET_SOURCE_META,
  SUPPORT_TICKET_SOURCE_TOOLS,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_UPDATE_TOOLS,
  toPlainObject,
  truncateHandoffText,
  WARRANTY_RESOLUTION_LABELS,
  WARRANTY_RESOLUTIONS,
  WARRANTY_STATUS_LABELS,
  websiteConfigRepository
} = require('../tool.helpers')

function getLocalizedWebsiteConfigText(source = {}, language = 'vi', path = '') {
  const normalizedLanguage = normalizePolicyLanguage(language)
  const localizedRoot = getGuideLocalizedRoot(source, normalizedLanguage)
  return getGuideText(source, localizedRoot, path)
}

function buildStoreSocialMediaPayload(contactInfo = {}) {
  const source = contactInfo && typeof contactInfo === 'object' ? contactInfo : {}
  const rawSocialMedia = toPlainObject(source.socialMedia)
  const socialMedia = rawSocialMedia && typeof rawSocialMedia === 'object' && !Array.isArray(rawSocialMedia)
    ? rawSocialMedia
    : {}
  const keys = new Set([...STORE_SOCIAL_MEDIA_FIELDS, ...Object.keys(socialMedia)])

  return Array.from(keys).reduce((result, key) => {
    const value = pickString(socialMedia[key], source[key])
    if (value) result[key] = value
    return result
  }, {})
}

function buildSupportChannelLinks({ hotline, email, socialMedia }) {
  const phone = normalizePhone(hotline)
  const phoneDigits = phone.replace(/\D/g, '')
  const links = {}

  if (phone) links.phone = `tel:${phone}`
  if (email) links.email = `mailto:${email}`
  if (phoneDigits) links.zalo = `https://zalo.me/${phoneDigits}`

  Object.entries(socialMedia || {}).forEach(([key, value]) => {
    if (value) links[key] = value
  })

  return links
}

function buildSupportInfoPayload(config = {}, language = 'vi') {
  const source = toPlainObject(config)
  const contactInfo = toPlainObject(source.contactInfo)
  const shoppingGuide = toPlainObject(source.shoppingGuide)
  const hotline = pickString(contactInfo.hotline, contactInfo.phone)
  const email = pickString(contactInfo.supportEmail, contactInfo.email)
  const supportHours = pickString(
    contactInfo.supportHours,
    contactInfo.workingTime,
    contactInfo.businessHours,
    source.supportHours,
    source.workingTime,
    source.businessHours,
    getLocalizedWebsiteConfigText(shoppingGuide, language, 'supportSection.workingTime')
  )
  const socialMedia = buildStoreSocialMediaPayload(contactInfo)
  const website = pickString(contactInfo.website, source.website, CLIENT_URL)
  const address = pickString(contactInfo.address)
  const hasSupportInfo = Boolean(
    hotline
    || email
    || supportHours
    || Object.keys(socialMedia).length > 0
  )

  return {
    hotline: hotline || null,
    phone: hotline || null,
    email: email || null,
    supportHours: supportHours || null,
    address: address || null,
    website: website || null,
    socialMedia,
    channels: buildSupportChannelLinks({ hotline, email, socialMedia }),
    hasSupportInfo,
    source: 'websiteConfig'
  }
}

function buildStoreLocationAddress(location = {}) {
  const explicitAddress = pickString(location.address)
  if (explicitAddress) return explicitAddress

  return [
    location.addressLine1,
    location.wardName,
    location.districtName,
    location.provinceName
  ].map(value => cleanString(value)).filter(Boolean).join(', ')
}

function buildMapLinks({ address, mapUrl }) {
  const normalizedAddress = cleanString(address)
  const normalizedMapUrl = pickString(mapUrl)
  const searchUrl = normalizedAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress)}`
    : null

  return {
    mapUrl: normalizedMapUrl || searchUrl,
    directionsUrl: normalizedMapUrl || searchUrl
  }
}

function normalizeStoreLocation(rawLocation = {}, index = 0, config = {}, language = 'vi') {
  const location = toPlainObject(rawLocation)
  const source = toPlainObject(config)
  const contactInfo = toPlainObject(source.contactInfo)
  const shoppingGuide = toPlainObject(source.shoppingGuide)
  const address = buildStoreLocationAddress(location)
  if (!address) return null

  const latitude = Number(location.latitude ?? location.lat)
  const longitude = Number(location.longitude ?? location.lng ?? location.lon)
  const mapUrl = pickString(location.mapUrl, location.googleMapUrl, location.mapsUrl, location.directionUrl)
  const workingHours = pickString(
    location.workingHours,
    location.supportHours,
    location.businessHours,
    contactInfo.supportHours,
    contactInfo.workingTime,
    contactInfo.businessHours,
    getLocalizedWebsiteConfigText(shoppingGuide, language, 'supportSection.workingTime')
  )
  const links = buildMapLinks({ address, mapUrl })

  return {
    id: pickString(location.id, location.key, location._id?.toString?.()) || `store-location-${index + 1}`,
    name: pickString(location.name, location.title, source.siteName) || `Dia diem ${index + 1}`,
    address,
    provinceName: pickString(location.provinceName, location.city) || null,
    districtName: pickString(location.districtName, location.district) || null,
    wardName: pickString(location.wardName, location.ward) || null,
    phone: pickString(location.phone, location.hotline, contactInfo.phone, contactInfo.hotline) || null,
    email: pickString(location.email, contactInfo.email, contactInfo.supportEmail) || null,
    workingHours: workingHours || null,
    note: pickString(location.note, location.notes, location.description) || null,
    isPrimary: location.isPrimary === true || index === 0,
    coordinates: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null,
    ...links
  }
}

function getConfiguredStoreLocations(config = {}, language = 'vi') {
  const source = toPlainObject(config)
  const contactInfo = toPlainObject(source.contactInfo)
  const rawLocations = [
    ...(
      Array.isArray(contactInfo.locations)
        ? contactInfo.locations
        : []
    ),
    ...(
      Array.isArray(contactInfo.branches)
        ? contactInfo.branches
        : []
    ),
    ...(
      Array.isArray(source.locations)
        ? source.locations
        : []
    )
  ]
  const locations = rawLocations
    .map((location, index) => normalizeStoreLocation(location, index, source, language))
    .filter(Boolean)

  if (locations.length > 0) {
    return locations.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  }

  const fallbackLocation = normalizeStoreLocation({
    name: source.siteName,
    address: contactInfo.address,
    phone: contactInfo.phone || contactInfo.hotline,
    email: contactInfo.email || contactInfo.supportEmail,
    workingHours: contactInfo.supportHours || contactInfo.workingTime || contactInfo.businessHours
  }, 0, source, language)

  return fallbackLocation ? [fallbackLocation] : []
}

function locationMatchesFilter(location = {}, { city = '', keyword = '' } = {}) {
  const cityFilter = normalizeSearchText(city)
  const keywordFilter = normalizeSearchText(keyword)
  const haystack = normalizeSearchText([
    location.name,
    location.address,
    location.provinceName,
    location.districtName,
    location.wardName,
    location.note
  ].filter(Boolean).join(' '))

  return (!cityFilter || haystack.includes(cityFilter))
    && (!keywordFilter || haystack.includes(keywordFilter))
}

function buildStoreLocationsPayload(config = {}, {
  language = 'vi',
  city = '',
  keyword = '',
  limit = 5
} = {}) {
  const locations = getConfiguredStoreLocations(config, language)
  const filteredLocations = locations.filter(location => locationMatchesFilter(location, { city, keyword }))
  const normalizedLimit = Math.min(Math.max(Number(limit) || 5, 1), 10)

  return {
    found: filteredLocations.length > 0,
    configFound: true,
    language,
    count: Math.min(filteredLocations.length, normalizedLimit),
    totalCount: filteredLocations.length,
    locations: filteredLocations.slice(0, normalizedLimit),
    message: filteredLocations.length > 0
      ? 'Da lay dia diem cua hang tu website config.'
      : 'Website config chua co dia diem cua hang phu hop voi bo loc.'
  }
}

function buildContactRequestSummary(result = {}, args = {}) {
  const request = result.request || {}
  const contactParts = [
    request.name,
    request.email,
    request.phone
  ].filter(Boolean)
  const subject = cleanString(request.subject || args.subject || 'Yeu cau lien he')
  const contact = contactParts.length > 0 ? contactParts.join(' / ') : 'khach hang'

  return truncateHandoffText(`Contact request ${result.ticketId || request.ticketId || ''}: ${subject} (${contact})`, 500)
}

function buildContactRequestResponse(result = {}, args = {}) {
  const escalationReason = buildContactRequestSummary(result, args)

  return {
    ...result,
    ticketCreated: true,
    handoffRequested: true,
    escalate: true,
    escalationReason,
    reason: escalationReason,
    summary: result.request?.subject || args.subject || result.request?.message || args.message || null,
    priority: result.request?.priority || args.priority || 'normal',
    message: `Minh da ghi nhan yeu cau lien he ${result.ticketId}. Nhan vien ho tro se kiem tra va lien he lai theo thong tin ban da cung cap.`,
    nextAction: 'support_follow_up'
  }
}

function buildSupportTicketResponse(result = {}, args = {}) {
  const request = result.request || {}

  return {
    ...result,
    ticketCreated: true,
    handoffRequested: false,
    escalate: false,
    ticket: {
      ticketId: result.ticketId || request.ticketId || null,
      category: request.category || args.category || 'general',
      priority: request.priority || args.priority || 'normal',
      subject: request.subject || args.subject || null,
      preferredContactMethod: request.preferredContactMethod || args.preferredContactMethod || args.contactMethod || null,
      createdAt: request.createdAt || null
    },
    message: `Minh da tao ticket ${result.ticketId}. Nhan vien ho tro se theo doi va phan hoi theo thong tin lien he ban da cung cap.`,
    nextAction: 'support_ticket_follow_up'
  }
}

function normalizeSupportRequestType(value) {
  const normalized = cleanString(value).toLowerCase()
  return SUPPORT_REQUEST_TYPE_TOOLS[normalized] ? normalized : 'all'
}

function normalizeSupportTicketId(value) {
  const normalized = cleanString(value).replace(/^#/, '').toUpperCase()
  const ticketMatch = normalized.match(/CR-\d{8}-\d{6}-[A-Z0-9]+/)

  return ticketMatch ? ticketMatch[0] : normalized
}

function getSupportTicketObject(value) {
  return value && typeof value === 'object' ? value : {}
}

function extractSupportTicketPayload(payload = {}, fallbackTicketId = '') {
  const ticket = getSupportTicketObject(payload.ticket)
  const request = getSupportTicketObject(payload.request)

  return {
    ticketId: normalizeSupportTicketId(payload.ticketId || ticket.ticketId || request.ticketId || fallbackTicketId),
    category: cleanString(ticket.category || request.category),
    priority: cleanString(ticket.priority || request.priority || payload.priority),
    subject: cleanString(ticket.subject || request.subject || payload.summary),
    createdAt: ticket.createdAt || request.createdAt || null
  }
}

function normalizeSupportTicketUrlValue(value) {
  if (!value) return ''
  if (typeof value === 'object') {
    return cleanString(value.url || value.imageUrl || value.fileUrl || value.href)
  }
  return cleanString(value)
}

function normalizeSupportTicketUrlList(...sources) {
  const urls = []

  for (const source of sources) {
    if (Array.isArray(source)) {
      source.forEach(item => {
        const url = normalizeSupportTicketUrlValue(item)
        if (url) urls.push(url)
      })
      continue
    }

    const url = normalizeSupportTicketUrlValue(source)
    if (url) urls.push(url)
  }

  return [...new Set(urls)].slice(0, 10)
}

function normalizeSupportTicketStatus(payload = {}) {
  const ticket = getSupportTicketObject(payload.ticket)
  const request = getSupportTicketObject(payload.request)
  const explicitStatus = cleanString(payload.status || ticket.status || request.status).toLowerCase()

  if (explicitStatus === 'canceled') return 'cancelled'
  if (explicitStatus) return explicitStatus
  if (payload.success === false || payload.error) return 'error'

  return 'submitted'
}

function getSupportTicketStatusLabel(status) {
  return SUPPORT_TICKET_STATUS_LABELS[status] || status || SUPPORT_TICKET_STATUS_LABELS.submitted
}

function getSupportTicketContactSources(log = {}, payload = {}) {
  const toolArgs = getSupportTicketObject(log.toolArgs)

  return [
    toolArgs,
    getSupportTicketObject(toolArgs.contact),
    getSupportTicketObject(payload.request)
  ]
}

function supportTicketEmailMatches(source = {}, email = '') {
  return !!email && cleanString(source.email).toLowerCase() === email
}

function supportTicketPhoneMatches(source = {}, phone = '') {
  return !!phone && normalizePhone(source.phone) === phone
}

function isSupportTicketLookupVerified(log = {}, args = {}, context = {}, payload = {}) {
  const contextUserId = cleanString(context.userId || context.customerInfo?.userId)
  const contextSessionId = cleanString(context.sessionId)

  if (contextSessionId && cleanString(log.sessionId) === contextSessionId) return true
  if (contextUserId && cleanString(log.userId) === contextUserId) return true

  const email = cleanString(args.email || context.customerInfo?.email).toLowerCase()
  const phone = normalizePhone(args.phone || context.customerInfo?.phone)
  const contactSources = getSupportTicketContactSources(log, payload)

  return contactSources.some(source =>
    supportTicketEmailMatches(source, email) || supportTicketPhoneMatches(source, phone)
  )
}

async function findSupportTicketLog(ticketId, sourceTools = SUPPORT_TICKET_SOURCE_TOOLS) {
  const ticketRegex = new RegExp(escapeRegExp(ticketId), 'i')
  const logs = await agentToolCallRepository.findByQuery({
    toolName: { $in: sourceTools },
    outcome: 'success',
    $or: [
      { resultPayload: ticketRegex },
      { resultPreview: ticketRegex }
    ]
  }, {
    sort: { createdAt: -1 },
    limit: 20,
    lean: true
  })

  return logs.find(log => {
    const payload = parseToolPayload(log.resultPayload) || {}
    const ticket = extractSupportTicketPayload(payload, ticketId)

    return ticket.ticketId === ticketId
      || ticketRegex.test(log.resultPayload || '')
      || ticketRegex.test(log.resultPreview || '')
  }) || null
}

async function findSupportTicketUpdateLogs(ticketId) {
  const ticketRegex = new RegExp(escapeRegExp(ticketId), 'i')
  return agentToolCallRepository.findByQuery({
    toolName: { $in: SUPPORT_TICKET_UPDATE_TOOLS },
    outcome: 'success',
    $or: [
      { resultPayload: ticketRegex },
      { resultPreview: ticketRegex }
    ]
  }, {
    sort: { createdAt: -1, _id: -1 },
    limit: 10,
    lean: true
  })
}

function buildSupportTicketUpdatePayload(log = {}) {
  const payload = parseToolPayload(log.resultPayload) || {}
  const update = getSupportTicketObject(payload.update)
  const ticketId = normalizeSupportTicketId(payload.ticketId || update.ticketId)
  const message = truncateHandoffText(update.message || payload.updateMessage || '', 500)
  const imageUrls = normalizeSupportTicketUrlList(update.imageUrls)
  const attachmentUrls = normalizeSupportTicketUrlList(update.attachmentUrls)
  const createdAt = update.createdAt || serializeDate(log.createdAt)

  if (!ticketId) return null

  return {
    id: serializeId(log._id),
    ticketId,
    message: message || null,
    imageUrls,
    attachmentUrls,
    attachmentCount: Number(update.attachmentCount || attachmentUrls.length || imageUrls.length || 0),
    createdAt,
    createdAtFormatted: createdAt ? formatDate(createdAt) : null,
    sourceTool: log.toolName
  }
}

function buildSupportTicketStatusResponse(log = {}, payload = {}, args = {}, context = {}, fallbackTicketId = '') {
  const ticket = extractSupportTicketPayload(payload, fallbackTicketId)
  const status = normalizeSupportTicketStatus(payload)
  const statusLabel = getSupportTicketStatusLabel(status)
  const sourceMeta = SUPPORT_TICKET_SOURCE_META[log.toolName] || {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  }
  const verified = isSupportTicketLookupVerified(log, args, context, payload)
  const createdAt = ticket.createdAt || serializeDate(log.createdAt)
  const isCancelled = status === 'cancelled'
  const response = {
    success: true,
    found: true,
    ticketId: ticket.ticketId,
    status,
    statusLabel,
    processingState: status === 'submitted' ? 'pending_support_review' : status,
    ticketType: sourceMeta.type,
    ticketTypeLabel: sourceMeta.label,
    sourceTool: log.toolName,
    createdAt,
    lastUpdatedAt: serializeDate(log.updatedAt || log.createdAt),
    verified,
    detailsRestricted: !verified,
    statusNote: 'Trang thai duoc lay tu ticket da ghi nhan qua chatbot; khong tu suy doan da xu ly xong neu chua co cap nhat.',
    message: status === 'error'
      ? `Ticket ${ticket.ticketId} chua duoc tao thanh cong.`
      : (isCancelled
          ? `Ticket ${ticket.ticketId} da duoc ghi nhan huy theo yeu cau cua khach.`
          : `Ticket ${ticket.ticketId} da duoc ghi nhan va dang cho nhan vien ho tro kiem tra.`),
    nextAction: isCancelled ? 'support_ticket_cancelled' : 'wait_for_support_response'
  }

  if (verified) {
    response.ticket = {
      ticketId: ticket.ticketId,
      category: ticket.category || null,
      priority: ticket.priority || null,
      subject: ticket.subject || null,
      createdAt
    }
    response.issueType = cleanString(payload.issueType) || null
    response.severity = cleanString(payload.severity) || null
    response.requestType = cleanString(payload.requestType) || null
    response.preferredResolution = cleanString(payload.preferredResolution) || null
    response.warrantyRequestCreated = payload.warrantyRequestCreated === true
    response.requestedResolution = cleanString(payload.requestedResolution) || null
    response.requestedResolutionLabel = cleanString(payload.requestedResolutionLabel) || null
    response.warranty = payload.warranty || null
    response.item = payload.item || null
    response.accountDeletionRequested = payload.accountDeletionRequested === true
    response.paymentProofSubmitted = payload.paymentProofSubmitted === true
    response.paymentVerified = payload.paymentVerified === true
    response.proof = payload.proof || null
    response.cancelledByCustomer = payload.cancelledByCustomer === true || isCancelled
    response.cancellation = payload.cancellation || null
  }

  return response
}

function addSupportTicketUpdatesToStatusResponse(response = {}, updateLogs = []) {
  if (!response.verified) return response

  const updates = updateLogs
    .map(buildSupportTicketUpdatePayload)
    .filter(Boolean)

  response.updateCount = updates.length
  response.updates = updates

  if (updates.length > 0) {
    response.lastUpdatedAt = updates[0].createdAt || response.lastUpdatedAt
    response.statusNote = 'Trang thai duoc lay tu ticket chatbot; cac thong tin bo sung gan day duoc liet ke trong updates neu da xac minh duoc quyen xem.'
  }

  return response
}

function isCreatedSupportRequest(payload = {}) {
  if (!payload || payload.success === false) return false

  return payload.ticketCreated === true
    || payload.callbackScheduled === true
    || payload.bugReportCreated === true
    || payload.returnRequestCreated === true
    || !!payload.ticketId
    || !!payload.ticket?.ticketId
    || !!payload.request?.ticketId
}

function buildSupportRequestCallbackPayload(callback = null) {
  if (!callback || typeof callback !== 'object') return null

  return {
    preferredContactMethod: cleanString(callback.preferredContactMethod) || null,
    callbackAt: cleanString(callback.callbackAt) || null,
    preferredDate: cleanString(callback.preferredDate) || null,
    preferredTime: cleanString(callback.preferredTime) || null,
    preferredTimeWindow: cleanString(callback.preferredTimeWindow) || null,
    timezone: cleanString(callback.timezone) || null,
    reason: truncateHandoffText(callback.reason, 180) || null
  }
}

function buildSupportRequestOrderReference(order = null) {
  if (!order || typeof order !== 'object') return null

  return {
    id: serializeId(order._id || order.id),
    orderCode: cleanString(order.orderCode) || null,
    code: cleanString(order.code) || null,
    status: cleanString(order.status) || null,
    paymentStatus: cleanString(order.paymentStatus) || null,
    paymentMethod: cleanString(order.paymentMethod) || null,
    paymentReference: cleanString(order.paymentReference) || null,
    totalFormatted: cleanString(order.totalFormatted) || null,
    orderUrl: cleanString(order.orderUrl) || null
  }
}

function buildSupportRequestListItem(log = {}) {
  const payload = parseToolPayload(log.resultPayload) || {}
  if (!isCreatedSupportRequest(payload)) return null

  const ticket = extractSupportTicketPayload(payload)
  const status = normalizeSupportTicketStatus(payload)
  const sourceMeta = SUPPORT_REQUEST_SOURCE_META[log.toolName] || {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  }
  const createdAt = ticket.createdAt || serializeDate(log.createdAt)
  const update = getSupportTicketObject(payload.update)
  const summary = truncateHandoffText(
    pickString(payload.summary, update.message, ticket.subject, payload.message, log.resultPreview),
    240
  )

  return {
    id: serializeId(log._id),
    ticketId: ticket.ticketId || null,
    type: sourceMeta.type,
    typeLabel: sourceMeta.label,
    status,
    statusLabel: getSupportTicketStatusLabel(status),
    processingState: status === 'submitted' ? 'pending_support_review' : status,
    category: ticket.category || null,
    priority: ticket.priority || null,
    subject: ticket.subject || null,
    summary: summary || null,
    createdAt,
    createdAtFormatted: createdAt ? formatDate(createdAt) : null,
    lastUpdatedAt: serializeDate(log.updatedAt || log.createdAt),
    sourceTool: log.toolName,
    sessionId: log.sessionId || null,
    callback: buildSupportRequestCallbackPayload(payload.callback),
    issueType: cleanString(payload.issueType) || null,
    severity: cleanString(payload.severity) || null,
    requestType: cleanString(payload.requestType) || null,
    preferredResolution: cleanString(payload.preferredResolution) || null,
    requestedResolution: cleanString(payload.requestedResolution) || null,
    requestedResolutionLabel: cleanString(payload.requestedResolutionLabel) || null,
    warranty: payload.warranty || null,
    item: payload.item || null,
    accountDeletionRequested: payload.accountDeletionRequested === true,
    paymentProofSubmitted: payload.paymentProofSubmitted === true,
    paymentVerified: payload.paymentVerified === true,
    proof: payload.proof || null,
    order: buildSupportRequestOrderReference(payload.order),
    nextAction: payload.nextAction || null
  }
}

function isSupportTicketAlreadyCancelled(status) {
  return SUPPORT_TICKET_ALREADY_CANCELLED_STATUSES.includes(cleanString(status).toLowerCase())
}

function canCancelSupportTicketStatus(status) {
  const normalized = cleanString(status).toLowerCase()
  return !SUPPORT_TICKET_NON_CANCELLABLE_STATUSES.includes(normalized)
}

function buildCancelledSupportTicketPayload(payload = {}, {
  ticketId,
  previousStatus = 'submitted',
  reason = '',
  cancelledAt,
  context = {}
} = {}) {
  const sourceTicket = getSupportTicketObject(payload.ticket)
  const sourceRequest = getSupportTicketObject(payload.request)
  const cancellation = {
    cancelledAt,
    reason: reason || null,
    requestedBy: 'customer',
    sessionId: cleanString(context.sessionId) || null,
    userId: cleanString(normalizeUserId(context)) || null
  }

  return {
    ...payload,
    success: payload.success !== false,
    status: 'cancelled',
    previousStatus,
    cancelledByCustomer: true,
    cancelledAt,
    cancellation,
    ticket: {
      ...sourceTicket,
      ticketId: sourceTicket.ticketId || ticketId,
      status: 'cancelled',
      cancelledAt,
      cancellationReason: reason || undefined
    },
    request: Object.keys(sourceRequest).length > 0
      ? {
          ...sourceRequest,
          ticketId: sourceRequest.ticketId || ticketId,
          status: 'cancelled',
          cancelledAt,
          cancellationReason: reason || undefined
        }
      : sourceRequest,
    message: `Da ghi nhan huy ticket ${ticketId} theo yeu cau cua khach.`,
    nextAction: 'support_ticket_cancelled'
  }
}

function getSupportTicketContactValue(log = {}, payload = {}, args = {}, context = {}, field) {
  const sources = getSupportTicketContactSources(log, payload)
  return pickString(
    args[field],
    context.customerInfo?.[field],
    ...sources.map(source => source[field])
  )
}

function normalizeWarrantyResolution(value) {
  const normalized = normalizeSearchText(value)
  if (normalized.includes('replace') || normalized.includes('doi') || normalized.includes('1 1')) return 'replacement'
  if (normalized.includes('technical') || normalized.includes('ky thuat') || normalized.includes('huong dan')) return 'technical_support'
  if (normalized.includes('manufacturer') || normalized.includes('nha cung cap') || normalized.includes('nha san xuat')) return 'manufacturer_support'
  if (normalized.includes('repair') || normalized.includes('sua') || normalized.includes('khac phuc')) return 'repair'

  const raw = cleanString(value).toLowerCase()
  return WARRANTY_RESOLUTIONS.includes(raw) ? raw : 'technical_support'
}

function normalizeWarrantyMediaUrls(value) {
  const items = Array.isArray(value)
    ? value
    : (cleanString(value) ? [value] : [])

  return [...new Set(items.map(item => cleanString(item)).filter(Boolean))].slice(0, 8)
}

function getWarrantyOrderLookup(args = {}) {
  return cleanString(args.orderId || args.orderCode)
}

async function resolveWarrantyOrder(args = {}, context = {}, options = {}) {
  const userId = normalizeUserId(context)
  const orderLookup = getWarrantyOrderLookup(args)
  const ticketId = cleanString(args.ticketId)

  if (isMongoObjectId(userId)) {
    if (!orderLookup) {
      const result = await ordersService.getMyOrders(userId)
      const orders = Array.isArray(result?.orders) ? result.orders.slice(0, 5) : []

      return {
        error: {
          success: false,
          found: orders.length > 0,
          requiresOrderSelection: true,
          ticketId: ticketId || null,
          message: orders.length > 0
            ? 'Vui long chon ma don hang can kiem tra hoac yeu cau bao hanh.'
            : 'Tai khoan dang chat chua co don hang nao de kiem tra bao hanh.',
          orders: orders.map(buildOrderSummaryPayload)
        }
      }
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return { error: { success: false, ...resolved.error } }

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return {
      order: result.order,
      verifiedBy: 'account',
      userId
    }
  }

  if (!orderLookup) {
    return {
      error: {
        success: false,
        found: false,
        requiresLogin: true,
        requiresOrder: true,
        message: options.action === 'request'
          ? 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de tao yeu cau bao hanh.'
          : 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de kiem tra bao hanh.'
      }
    }
  }

  const phone = normalizePhone(args.phone || args.contact?.phone || context.customerInfo?.phone)
  if (!phone) {
    return {
      error: {
        success: false,
        found: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai da dung khi dat hang de xac minh don hang.'
      }
    }
  }

  const tracked = await ordersService.trackOrder({
    orderCode: orderLookup,
    phone
  })
  const trackedOrderId = tracked?.order?.id?.toString?.() || String(tracked?.order?.id || '')
  const order = isMongoObjectId(trackedOrderId)
    ? await orderRepository.findOne({ _id: trackedOrderId, isDeleted: false })
    : null

  return {
    order: order || tracked?.order || null,
    verifiedBy: 'order_code_phone',
    userId: null
  }
}

function getWarrantyOrderItems(order = {}) {
  const source = toPlainObject(order)
  return Array.isArray(source.orderItems) ? source.orderItems : []
}

function buildWarrantyOrderItemPayload(item = {}) {
  const productId = serializeId(item.productId)

  return {
    productId: productId || null,
    name: cleanString(item.name) || 'San pham',
    quantity: Number(item.quantity || 0) || null,
    deliveryType: cleanString(item.deliveryType) || null
  }
}

function itemMatchesWarrantyLookup(item = {}, lookup = '') {
  const normalizedLookup = normalizeSearchText(lookup)
  if (!normalizedLookup) return false

  const productId = serializeId(item.productId).toLowerCase()
  if (productId && productId === cleanString(lookup).toLowerCase()) return true

  const normalizedName = normalizeSearchText(item.name)
  if (!normalizedName) return false

  return normalizedName === normalizedLookup
    || normalizedName.includes(normalizedLookup)
    || normalizedLookup.includes(normalizedName)
}

function selectWarrantyOrderItem(order = {}, args = {}) {
  const items = getWarrantyOrderItems(order)
  if (items.length === 0) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Don hang nay khong co san pham de kiem tra bao hanh.'
      }
    }
  }

  const lookup = cleanString(args.productId || args.productQuery || args.productName || args.itemName)
  if (!lookup && items.length === 1) return { item: items[0] }

  if (!lookup) {
    return {
      error: {
        success: false,
        found: true,
        requiresProductSelection: true,
        message: 'Don hang co nhieu san pham. Vui long chon san pham can kiem tra bao hanh.',
        items: items.map(buildWarrantyOrderItemPayload)
      }
    }
  }

  const item = items.find(orderItem => itemMatchesWarrantyLookup(orderItem, lookup))
  if (!item) {
    return {
      error: {
        success: false,
        found: false,
        requiresProductSelection: true,
        message: 'Khong tim thay san pham khop trong don hang nay.',
        items: items.map(buildWarrantyOrderItemPayload)
      }
    }
  }

  return { item }
}

async function resolveWarrantyProduct(item = {}, args = {}) {
  const productId = cleanString(args.productId) || serializeId(item.productId)
  if (isMongoObjectId(productId)) {
    const product = await productRepository.findById(productId, {
      populate: { path: 'productCategory', select: 'title' },
      lean: true
    })
    if (product) return product
  }

  return findProductByQuery(args.productQuery || item.name || productId)
}

function collectWarrantyPolicyTexts(product = {}, item = {}) {
  const source = toPlainObject(product)
  const translations = toPlainObject(source.translations?.en)
  const rawTexts = [
    source.description,
    source.content,
    source.deliveryInstructions,
    item.deliveryInstructions,
    translations.description,
    translations.content,
    translations.deliveryInstructions,
    ...(Array.isArray(source.features) ? source.features : []),
    ...(Array.isArray(translations.features) ? translations.features : [])
  ]

  return rawTexts.map(value => cleanString(value)).filter(Boolean)
}

function parseWarrantyDuration(text = '') {
  const normalized = normalizeSearchText(text)
  const patterns = [
    /(?:bao hanh|warranty).{0,80}?(\d{1,3})\s*(ngay|day|days|thang|month|months|nam|year|years)/i,
    /(\d{1,3})\s*(ngay|day|days|thang|month|months|nam|year|years).{0,80}?(?:bao hanh|warranty)/i
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue

    const amount = Number(match[1])
    const unit = match[2]
    if (!Number.isFinite(amount) || amount <= 0) continue

    if (['ngay', 'day', 'days'].includes(unit)) {
      return { durationDays: amount, durationLabel: `${amount} ngay` }
    }
    if (['thang', 'month', 'months'].includes(unit)) {
      return { durationDays: amount * 30, durationLabel: `${amount} thang` }
    }
    if (['nam', 'year', 'years'].includes(unit)) {
      return { durationDays: amount * 365, durationLabel: `${amount} nam` }
    }
  }

  return { durationDays: null, durationLabel: null }
}

function extractWarrantyPolicy(product = {}, item = {}) {
  const texts = collectWarrantyPolicyTexts(product, item)
  const warrantyTexts = texts.filter(text => {
    const normalized = normalizeSearchText(text)
    return normalized.includes('bao hanh')
      || normalized.includes('warranty')
      || normalized.includes('1 1')
  })
  const sourceText = warrantyTexts.join(' ') || texts.join(' ')
  const duration = parseWarrantyDuration(sourceText)
  const policyText = warrantyTexts[0] || ''

  return {
    found: warrantyTexts.length > 0 || !!duration.durationDays,
    source: warrantyTexts.length > 0 ? 'product_content' : 'not_found',
    text: policyText ? truncateHandoffText(policyText, 500) : null,
    durationDays: duration.durationDays,
    durationLabel: duration.durationLabel
  }
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function buildWarrantyWindow(order = {}, policy = {}) {
  const source = toPlainObject(order)
  const startAt = source.createdAt || null
  const durationDays = Number(policy.durationDays)
  if (!startAt || !Number.isFinite(durationDays) || durationDays <= 0) {
    return {
      startedAt: startAt || null,
      expiresAt: null,
      isExpired: null
    }
  }

  const expiresAt = addDays(new Date(startAt), durationDays)
  return {
    startedAt: startAt,
    expiresAt: expiresAt.toISOString(),
    isExpired: expiresAt.getTime() < Date.now()
  }
}

function resolveWarrantyStatus(order = {}, policy = {}, window = {}) {
  const source = toPlainObject(order)

  if (source.status === 'cancelled') return 'order_cancelled'
  if (source.status === 'pending') return 'order_pending'
  if (source.paymentStatus && source.paymentStatus !== 'paid') return 'payment_not_confirmed'
  if (window.isExpired === true) return 'expired'
  if (window.isExpired === false) return 'active'
  if (policy.found) return 'policy_found_needs_review'
  return 'policy_unknown'
}

function buildWarrantyStatusPayload(order = {}, item = {}, product = {}, options = {}) {
  const source = toPlainObject(order)
  const productSource = toPlainObject(product)
  const policy = extractWarrantyPolicy(productSource, item)
  const warrantyWindow = buildWarrantyWindow(source, policy)
  const status = resolveWarrantyStatus(source, policy, warrantyWindow)
  const itemPayload = buildWarrantyOrderItemPayload(item)
  const productId = serializeId(productSource._id || item.productId)

  return {
    success: true,
    found: true,
    verifiedBy: options.verifiedBy || null,
    order: buildOrderSummaryPayload(source),
    item: {
      ...itemPayload,
      productUrl: productSource.slug ? `${CLIENT_URL}/products/${productSource.slug}` : null
    },
    product: {
      productId: productId || itemPayload.productId,
      name: cleanString(productSource.title || item.name) || null,
      slug: cleanString(productSource.slug) || null
    },
    warranty: {
      status,
      statusLabel: WARRANTY_STATUS_LABELS[status] || status,
      eligibleForSupport: ['active', 'policy_found_needs_review', 'policy_unknown'].includes(status),
      policyFound: policy.found,
      policySource: policy.source,
      policyText: policy.text,
      durationDays: policy.durationDays,
      durationLabel: policy.durationLabel,
      startedAt: warrantyWindow.startedAt,
      expiresAt: warrantyWindow.expiresAt,
      isExpired: warrantyWindow.isExpired,
      statusNote: 'Trang thai bao hanh la uoc tinh tu du lieu don hang va noi dung san pham; nhan vien se xac minh dieu kien cuoi cung.'
    },
    suggestedTool: ['active', 'policy_found_needs_review', 'policy_unknown'].includes(status)
      ? 'requestWarrantySupport'
      : null,
    message: buildWarrantyStatusMessage(status, source, itemPayload, policy, warrantyWindow)
  }
}

function buildWarrantyStatusMessage(status, order = {}, item = {}, policy = {}, warrantyWindow = {}) {
  const code = order.orderCode || formatOrderCode(order)
  const productName = item.name || 'san pham'
  const label = WARRANTY_STATUS_LABELS[status] || status

  if (status === 'active') {
    return `${productName} trong don ${code} ${label.toLowerCase()}${warrantyWindow.expiresAt ? ` den ${formatDate(warrantyWindow.expiresAt)}` : ''}.`
  }

  if (status === 'expired') {
    return `${productName} trong don ${code} co the da het bao hanh du kien${warrantyWindow.expiresAt ? ` tu ${formatDate(warrantyWindow.expiresAt)}` : ''}. Neu can, co the tao ticket de nhan vien kiem tra lai.`
  }

  if (status === 'policy_found_needs_review') {
    return `${productName} co thong tin bao hanh trong noi dung san pham, nhung he thong chua xac dinh duoc ngay het han. Nhan vien can kiem tra dieu kien cu the.`
  }

  if (status === 'policy_unknown') {
    return `${productName} chua co thoi han bao hanh ro rang trong du lieu san pham. Co the tao ticket de nhan vien kiem tra chinh sach.`
  }

  return `${productName} trong don ${code} dang o trang thai: ${label}.`
}

function getWarrantyRequestContact(args = {}, order = {}, context = {}) {
  const source = args.contact && typeof args.contact === 'object' ? args.contact : args
  const customerInfo = context.customerInfo || {}
  const orderContact = toPlainObject(order).contact || {}
  const orderName = [orderContact.firstName, orderContact.lastName].filter(Boolean).join(' ').trim()

  return {
    name: pickString(source.name, source.fullName, customerInfo.name, orderName),
    email: pickString(source.email, customerInfo.email, orderContact.email),
    phone: normalizePhone(pickString(source.phone, args.phone, customerInfo.phone, orderContact.phone)),
    preferredContactMethod: cleanString(source.preferredContactMethod || args.preferredContactMethod) || undefined
  }
}

function buildWarrantySupportMessage({
  args = {},
  order = {},
  item = {},
  warrantyStatus = {},
  requestedResolution,
  mediaUrls = [],
  context = {}
} = {}) {
  const source = toPlainObject(order)
  const code = source.orderCode || formatOrderCode(source) || cleanString(args.orderCode || args.orderId)
  const itemPayload = buildWarrantyOrderItemPayload(item)
  const warranty = warrantyStatus.warranty || {}

  return [
    'Loai yeu cau: Bao hanh san pham',
    `Huong ho tro mong muon: ${WARRANTY_RESOLUTION_LABELS[requestedResolution] || requestedResolution}`,
    `Ma don: ${code || '(khong co)'}`,
    `Trang thai don: ${source.status || '(khong ro)'} / thanh toan: ${source.paymentStatus || '(khong ro)'}`,
    `San pham: ${itemPayload.name}${itemPayload.quantity ? ` x${itemPayload.quantity}` : ''}`,
    warranty.statusLabel ? `Trang thai bao hanh du kien: ${warranty.statusLabel}` : null,
    warranty.durationLabel ? `Thoi han bao hanh tim thay: ${warranty.durationLabel}` : null,
    warranty.expiresAt ? `Ngay het han du kien: ${formatDate(warranty.expiresAt)}` : null,
    warranty.policyText ? `Chinh sach/ghi chu san pham: ${warranty.policyText}` : null,
    mediaUrls.length > 0 ? `Anh/video minh chung: ${mediaUrls.join(' | ')}` : null,
    '',
    `Mo ta loi/tinh trang: ${cleanString(args.issueDescription || args.description || args.reason || args.details)}`,
    cleanString(context.promptText) ? `Noi dung chat gan nhat: ${cleanString(context.promptText)}` : null
  ].filter(line => line !== null).join('\n')
}

function normalizeBugIssueType(value, fallbackText = '') {
  const raw = cleanString(value).toLowerCase()
  if (BUG_ISSUE_TYPES.includes(raw)) return raw

  const normalized = normalizeSearchText(value || fallbackText)
  if (!normalized) return 'technical'

  if (normalized.includes('payment') || normalized.includes('thanh toan') || normalized.includes('vnpay') || normalized.includes('momo') || normalized.includes('zalopay') || normalized.includes('sepay')) return 'payment'
  if (normalized.includes('product') || normalized.includes('san pham') || normalized.includes('hang hoa') || normalized.includes('gia') || normalized.includes('ton kho')) return 'product'
  if (normalized.includes('order') || normalized.includes('don hang') || normalized.includes('giao hang')) return 'order'
  if (normalized.includes('account') || normalized.includes('tai khoan') || normalized.includes('dang nhap') || normalized.includes('login') || normalized.includes('register')) return 'account'
  if (normalized.includes('website') || normalized.includes('web') || normalized.includes('trang') || normalized.includes('checkout') || normalized.includes('gio hang')) return 'website'
  if (normalized.includes('technical') || normalized.includes('bug') || normalized.includes('error') || normalized.includes('loi') || normalized.includes('su co')) return 'technical'

  return 'other'
}

function normalizeBugIssueSeverity(value, issueType) {
  const raw = cleanString(value).toLowerCase()
  if (BUG_ISSUE_SEVERITIES.includes(raw)) return raw

  const normalized = normalizeSearchText(value)
  if (normalized.includes('urgent') || normalized.includes('khong the dung') || normalized.includes('nghiem trong') || normalized.includes('gap')) return 'urgent'
  if (normalized.includes('high') || normalized.includes('cao') || normalized.includes('khong thanh toan') || normalized.includes('mat tien')) return 'high'
  if (normalized.includes('low') || normalized.includes('thap') || normalized.includes('nho')) return 'low'

  return issueType === 'payment' ? 'high' : 'normal'
}

function normalizeBugReportStringList(value) {
  const rawItems = Array.isArray(value)
    ? value
    : (cleanString(value) ? [value] : [])

  return rawItems
    .map(item => cleanString(item))
    .filter(Boolean)
    .slice(0, 6)
}

function getBugReportContact(args = {}, context = {}) {
  const source = args.contact && typeof args.contact === 'object' ? args.contact : args
  const customerInfo = context.customerInfo || {}

  return {
    name: pickString(source.name, source.fullName, customerInfo.name),
    email: pickString(source.email, customerInfo.email),
    phone: normalizePhone(pickString(source.phone, args.phone, customerInfo.phone)),
    preferredContactMethod: cleanString(source.preferredContactMethod || args.preferredContactMethod) || undefined
  }
}

function buildBugReportMessage({
  args = {},
  issueType,
  severity,
  category,
  description,
  context = {}
} = {}) {
  const screenshots = normalizeBugReportStringList(args.screenshotUrls || args.screenshots || args.screenshotUrl)
  const contextPrompt = cleanString(context.promptText)

  return [
    `Loai su co: ${BUG_ISSUE_TYPE_LABELS[issueType] || issueType}`,
    `Muc do: ${severity}`,
    `Danh muc ticket: ${category}`,
    cleanString(args.title || args.subject) ? `Tieu de: ${cleanString(args.title || args.subject)}` : null,
    cleanString(args.pageUrl || args.currentPage) ? `Trang/URL loi: ${cleanString(args.pageUrl || args.currentPage)}` : null,
    cleanString(args.browser) ? `Trinh duyet: ${cleanString(args.browser)}` : null,
    cleanString(args.device) ? `Thiet bi: ${cleanString(args.device)}` : null,
    cleanString(args.orderCode || args.orderId) ? `Don hang lien quan: ${cleanString(args.orderCode || args.orderId)}` : null,
    cleanString(args.paymentReference) ? `Ma thanh toan/giao dich: ${cleanString(args.paymentReference)}` : null,
    cleanString(args.productQuery || args.productId) ? `San pham lien quan: ${cleanString(args.productQuery || args.productId)}` : null,
    screenshots.length > 0 ? `Anh chup man hinh: ${screenshots.join(' | ')}` : null,
    '',
    `Mo ta: ${description}`,
    cleanString(args.stepsToReproduce) ? `Cach tai hien: ${cleanString(args.stepsToReproduce)}` : null,
    cleanString(args.expectedBehavior) ? `Mong doi: ${cleanString(args.expectedBehavior)}` : null,
    cleanString(args.actualBehavior) ? `Thuc te: ${cleanString(args.actualBehavior)}` : null,
    contextPrompt ? `Noi dung chat gan nhat: ${contextPrompt}` : null
  ].filter(line => line !== null).join('\n')
}

function buildBugReportResponse(result = {}, args = {}, meta = {}) {
  const request = result.request || {}

  return {
    ...result,
    ticketCreated: true,
    bugReportCreated: true,
    handoffRequested: false,
    escalate: false,
    issueType: meta.issueType,
    severity: meta.severity,
    ticket: {
      ticketId: result.ticketId || request.ticketId || null,
      category: request.category || meta.category || 'technical',
      priority: request.priority || meta.severity || 'normal',
      subject: request.subject || meta.subject || null,
      preferredContactMethod: request.preferredContactMethod || args.preferredContactMethod || args.contactMethod || null,
      createdAt: request.createdAt || null
    },
    summary: request.subject || meta.subject || null,
    priority: request.priority || meta.severity || 'normal',
    message: `Minh da ghi nhan bao cao loi/su co ${result.ticketId}. Nhan vien ho tro se kiem tra va phan hoi theo thong tin lien he ban da cung cap.`,
    nextAction: 'bug_report_follow_up'
  }
}

function normalizeCallbackContactMethod(value) {
  const normalized = cleanString(value).toLowerCase()
  return CALLBACK_CONTACT_METHODS.includes(normalized) ? normalized : 'phone'
}

function isValidCallbackPhone(phone) {
  const digits = cleanString(phone).replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

function buildCallbackDetails(args = {}, context = {}) {
  const contact = args.contact && typeof args.contact === 'object' ? args.contact : {}
  const customerInfo = context.customerInfo || {}
  const phone = normalizePhone(pickString(args.phone, contact.phone, customerInfo.phone))
  const email = pickString(args.email, contact.email, customerInfo.email)
  const name = pickString(args.name, args.fullName, contact.name, contact.fullName, customerInfo.name)
  const callbackAt = pickString(args.callbackAt, args.preferredCallbackAt)
  const preferredDate = pickString(args.preferredDate, args.callbackDate, args.date)
  const preferredTime = pickString(args.preferredTime, args.callbackTime, args.time)
  const preferredTimeWindow = pickString(args.preferredTimeWindow, args.timeWindow, args.window)
  const timezone = pickString(args.timezone, customerInfo.timezone, context.timezone, DEFAULT_CALLBACK_TIMEZONE)
  const reason = truncateHandoffText(
    pickString(args.reason, args.topic, args.subject, context.promptText) || 'Khach yeu cau nhan vien goi lai.',
    500
  )
  const notes = truncateHandoffText(pickString(args.notes, args.details), 1000)
  const preferredContactMethod = normalizeCallbackContactMethod(
    pickString(args.preferredContactMethod, args.contactMethod, contact.preferredContactMethod, contact.contactMethod)
  )
  const whenParts = [
    callbackAt ? `Thoi diem: ${callbackAt}` : null,
    preferredDate ? `Ngay: ${preferredDate}` : null,
    preferredTime ? `Gio: ${preferredTime}` : null,
    preferredTimeWindow ? `Khung gio: ${preferredTimeWindow}` : null
  ].filter(Boolean)

  return {
    name,
    email,
    phone,
    preferredContactMethod,
    callbackAt,
    preferredDate,
    preferredTime,
    preferredTimeWindow,
    timezone,
    reason,
    notes,
    hasRequestedTime: whenParts.length > 0,
    whenLabel: whenParts.join(' | ')
  }
}

function buildCallbackRequestMessage(callback = {}, context = {}) {
  const currentPage = pickString(context.currentPage, context.customerInfo?.currentPage)

  return [
    'Loai yeu cau: Dat lich nhan vien goi lai',
    `Thoi gian mong muon: ${callback.whenLabel}`,
    `Mui gio: ${callback.timezone}`,
    `Kenh uu tien: ${callback.preferredContactMethod}`,
    `So dien thoai: ${callback.phone}`,
    callback.name ? `Ten khach: ${callback.name}` : null,
    callback.email ? `Email: ${callback.email}` : null,
    `Ly do: ${callback.reason}`,
    callback.notes ? `Ghi chu: ${callback.notes}` : null,
    currentPage ? `Trang hien tai: ${currentPage}` : null,
    cleanString(context.promptText) ? `Noi dung chat gan nhat: ${cleanString(context.promptText)}` : null
  ].filter(Boolean).join('\n')
}

function buildScheduleCallbackResponse(result = {}, callback = {}, priority = 'normal') {
  const request = result.request || {}
  const ticketId = result.ticketId || request.ticketId || null
  const ticketText = ticketId ? ` ${ticketId}` : ''
  const whenText = callback.whenLabel || 'khung gio ban da cung cap'

  return {
    ...result,
    ticketCreated: true,
    callbackScheduled: true,
    handoffRequested: false,
    escalate: false,
    ticket: {
      ticketId,
      category: request.category || 'general',
      priority: request.priority || priority,
      subject: request.subject || null,
      createdAt: request.createdAt || null
    },
    callback: {
      phone: request.phone || callback.phone,
      email: request.email || callback.email || null,
      preferredContactMethod: request.preferredContactMethod || callback.preferredContactMethod,
      callbackAt: callback.callbackAt || null,
      preferredDate: callback.preferredDate || null,
      preferredTime: callback.preferredTime || null,
      preferredTimeWindow: callback.preferredTimeWindow || null,
      timezone: callback.timezone,
      reason: callback.reason
    },
    summary: request.subject || callback.reason || null,
    priority: request.priority || priority,
    message: `Minh da ghi nhan lich nhan vien goi lai${ticketText}. Nhan vien se lien he so ${request.phone || callback.phone} theo ${whenText}.`,
    nextAction: 'staff_callback'
  }
}

function normalizeReturnRequestType(value) {
  const normalized = normalizeSearchText(value)

  if (!normalized) return 'return_refund'
  if (normalized.includes('exchange') || normalized.includes('doi san pham') || normalized.includes('doi hang')) return 'exchange'
  if (normalized.includes('refund') || normalized.includes('hoan tien')) return 'refund'
  if (normalized.includes('return') || normalized.includes('tra hang') || normalized.includes('doi tra')) return 'return'

  return RETURN_REQUEST_TYPES.includes(cleanString(value)) ? cleanString(value) : 'return_refund'
}

function normalizeReturnResolution(value, requestType) {
  const normalized = normalizeSearchText(value)

  if (normalized.includes('exchange') || normalized.includes('doi san pham') || normalized.includes('doi hang')) return 'exchange'
  if (normalized.includes('refund') || normalized.includes('hoan tien')) return 'refund'
  if (normalized.includes('store credit') || normalized.includes('diem') || normalized.includes('voucher')) return 'store_credit'
  if (normalized.includes('repair') || normalized.includes('sua') || normalized.includes('khac phuc')) return 'repair'
  if (RETURN_RESOLUTIONS.includes(cleanString(value))) return cleanString(value)

  if (requestType === 'exchange') return 'exchange'
  if (requestType === 'refund' || requestType === 'return_refund') return 'refund'
  return 'support'
}

function normalizeReturnRequestItems(items = []) {
  const rawItems = Array.isArray(items) ? items : []

  return rawItems
    .map(item => {
      const quantity = Number(item?.quantity)
      return {
        productId: cleanString(item?.productId),
        productQuery: cleanString(item?.productQuery || item?.name),
        name: cleanString(item?.name || item?.productQuery),
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : null,
        reason: cleanString(item?.reason, 500)
      }
    })
    .filter(item => item.productId || item.productQuery || item.name || item.reason)
}

function getReturnRequestContact(args = {}, order = {}, context = {}) {
  const source = args.contact && typeof args.contact === 'object' ? args.contact : args
  const customerInfo = context.customerInfo || {}
  const orderContact = toPlainObject(order).contact || {}
  const orderName = [orderContact.firstName, orderContact.lastName].filter(Boolean).join(' ').trim()

  return {
    name: pickString(source.name, source.fullName, customerInfo.name, orderName),
    email: pickString(source.email, customerInfo.email, orderContact.email),
    phone: normalizePhone(pickString(source.phone, args.phone, customerInfo.phone, orderContact.phone)),
    preferredContactMethod: cleanString(source.preferredContactMethod || args.preferredContactMethod) || undefined
  }
}

async function resolveReturnRequestOrder(args = {}, context = {}) {
  const userId = normalizeUserId(context)
  const orderLookup = cleanString(args.orderId || args.orderCode)

  if (isMongoObjectId(userId)) {
    if (!orderLookup) {
      return {
        error: {
          success: false,
          requiresOrder: true,
          message: 'Vui long cung cap ma don hang can tao yeu cau doi tra/hoan tien.'
        }
      }
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return { error: { success: false, ...resolved.error } }

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return {
      order: result.order,
      verifiedBy: 'account',
      userId
    }
  }

  if (!orderLookup) {
    return {
      error: {
        success: false,
        requiresLogin: true,
        requiresOrder: true,
        message: 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de tao yeu cau doi tra/hoan tien.'
      }
    }
  }

  const phone = normalizePhone(args.phone || args.contact?.phone || context.customerInfo?.phone)
  if (!phone) {
    return {
      error: {
        success: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai da dung khi dat hang de xac minh don hang.'
      }
    }
  }

  const tracked = await ordersService.trackOrder({
    orderCode: orderLookup,
    phone
  })
  const trackedOrderId = tracked?.order?.id?.toString?.() || String(tracked?.order?.id || '')
  const order = isMongoObjectId(trackedOrderId)
    ? await orderRepository.findOne({ _id: trackedOrderId, isDeleted: false })
    : null

  return {
    order: order || tracked?.order || null,
    verifiedBy: 'order_code_phone',
    userId: null
  }
}

function getReturnRequestWarnings(order = {}, requestType = 'return_refund') {
  const source = toPlainObject(order)
  const warnings = []

  if (!source?._id && !source?.id) return warnings

  if (source.status === 'pending') {
    warnings.push('Don hang dang cho xu ly; neu khach chi muon huy don pending thi nen dung cancelOrder thay vi yeu cau doi tra.')
  }

  if (source.status === 'cancelled') {
    warnings.push('Don hang da bi huy; nhan vien se can kiem tra truoc khi xu ly hoan tien/doi tra.')
  }

  if (['refund', 'return_refund'].includes(requestType) && source.paymentStatus && source.paymentStatus !== 'paid') {
    warnings.push('Don hang chua ghi nhan thanh toan thanh cong; khong duoc noi la da duyet hoan tien.')
  }

  return warnings
}

function normalizeReturnRefundStatus(value, fallback = 'requested') {
  const normalized = cleanString(value).toLowerCase()
  return RETURN_REFUND_STATUSES.includes(normalized) ? normalized : fallback
}

function normalizeReturnRefundSubStatus(value, fallback = 'not_applicable') {
  const normalized = cleanString(value).toLowerCase()
  return RETURN_REFUND_SUB_STATUSES.includes(normalized) ? normalized : fallback
}

function getReturnRefundRecord(order = {}) {
  const source = toPlainObject(order)
  return toPlainObject(source.returnRefund)
}

function hasReturnRefundRecord(record = {}) {
  return Boolean(
    cleanString(record.ticketId)
    || cleanString(record.status)
    || cleanString(record.requestType)
    || record.requestedAt
  )
}

function sanitizeReturnRefundItemsForOrder(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      productId: isMongoObjectId(item.productId) ? item.productId : undefined,
      productQuery: cleanString(item.productQuery),
      name: cleanString(item.name || item.productQuery),
      quantity: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
        ? Math.floor(Number(item.quantity))
        : undefined,
      reason: cleanString(item.reason)
    }))
    .filter(item => item.productId || item.productQuery || item.name || item.quantity || item.reason)
}

async function saveReturnRefundRequestStatus(order, {
  result = {},
  requestType,
  preferredResolution,
  items = [],
  args = {},
  priority
} = {}) {
  const source = toPlainObject(order)
  const orderId = source._id?.toString?.() || source.id?.toString?.() || cleanString(source._id || source.id)
  if (!isMongoObjectId(orderId)) return null

  const document = typeof order?.save === 'function'
    ? order
    : await orderRepository.findOne({ _id: orderId, isDeleted: false })

  if (!document) return null

  const now = new Date()
  document.returnRefund = {
    requestType,
    preferredResolution,
    status: 'requested',
    refundStatus: ['refund', 'return_refund'].includes(requestType) ? 'requested' : 'not_applicable',
    exchangeStatus: requestType === 'exchange' ? 'requested' : 'not_applicable',
    ticketId: result.ticketId || result.request?.ticketId || '',
    reason: cleanString(args.reason),
    details: cleanString(args.details).slice(0, 1000),
    items: sanitizeReturnRefundItemsForOrder(items),
    requestedAt: now,
    updatedAt: now,
    source: 'chatbot_return_refund',
    priority: cleanString(priority)
  }

  await document.save()
  return toPlainObject(document.returnRefund)
}

function getReturnRefundRecordPayload(record = {}) {
  const status = normalizeReturnRefundStatus(record.status)
  const refundStatus = normalizeReturnRefundSubStatus(record.refundStatus)
  const exchangeStatus = normalizeReturnRefundSubStatus(record.exchangeStatus)

  return {
    ticketId: cleanString(record.ticketId) || null,
    requestType: cleanString(record.requestType) || null,
    requestTypeLabel: RETURN_REQUEST_TYPE_LABELS[record.requestType] || record.requestType || null,
    preferredResolution: cleanString(record.preferredResolution) || null,
    preferredResolutionLabel: RETURN_RESOLUTION_LABELS[record.preferredResolution] || record.preferredResolution || null,
    status,
    statusLabel: RETURN_REFUND_STATUS_LABELS[status] || status,
    refundStatus,
    refundStatusLabel: RETURN_REFUND_SUB_STATUS_LABELS[refundStatus] || refundStatus,
    exchangeStatus,
    exchangeStatusLabel: RETURN_REFUND_SUB_STATUS_LABELS[exchangeStatus] || exchangeStatus,
    reason: cleanString(record.reason) || null,
    items: Array.isArray(record.items) ? record.items.map(item => ({
      productId: item.productId?.toString?.() || cleanString(item.productId),
      productQuery: cleanString(item.productQuery) || null,
      name: cleanString(item.name) || null,
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
      reason: cleanString(item.reason) || null
    })) : [],
    requestedAt: record.requestedAt || null,
    updatedAt: record.updatedAt || null,
    resolvedAt: record.resolvedAt || null,
    priority: cleanString(record.priority) || null
  }
}

function buildNoReturnRefundRecordGuidance(order = {}) {
  const source = toPlainObject(order)

  if (source.status === 'pending') {
    return {
      suggestedTool: 'cancelOrder',
      message: 'Don hang dang cho xac nhan va chua co yeu cau doi tra/hoan tien nao duoc ghi nhan. Neu khach chi muon huy don pending, hay dung cancelOrder sau khi khach xac nhan.'
    }
  }

  if (source.status === 'cancelled' && source.paymentStatus !== 'paid') {
    return {
      suggestedTool: null,
      message: 'Don hang da huy va he thong chua ghi nhan thanh toan thanh cong, nen chua co trang thai hoan tien tren don nay.'
    }
  }

  return {
    suggestedTool: 'requestReturnOrRefund',
    message: 'Chua co yeu cau doi tra/hoan tien nao duoc ghi nhan tren don hang nay. Neu khach muon tao yeu cau moi, hay dung requestReturnOrRefund sau khi khach xac nhan.'
  }
}

function buildReturnRefundStatusPayload(order = {}, { verifiedBy = null, ticketId = '' } = {}) {
  const source = toPlainObject(order)
  const record = getReturnRefundRecord(source)
  const recordFound = hasReturnRefundRecord(record)
  const normalizedTicketId = cleanString(ticketId).toLowerCase()
  const storedTicketId = cleanString(record.ticketId).toLowerCase()
  const ticketMatched = normalizedTicketId ? storedTicketId === normalizedTicketId : null
  const orderSummary = buildOrderSummaryPayload(source)

  if (!recordFound) {
    const guidance = buildNoReturnRefundRecordGuidance(source)
    return {
      found: true,
      requestFound: false,
      statusAvailable: false,
      verifiedBy,
      ticketMatched,
      order: orderSummary,
      returnRefund: null,
      suggestedTool: guidance.suggestedTool,
      message: guidance.message
    }
  }

  const payload = getReturnRefundRecordPayload(record)
  const ticketMismatch = normalizedTicketId && !ticketMatched

  return {
    found: true,
    requestFound: !ticketMismatch,
    statusAvailable: !ticketMismatch,
    verifiedBy,
    ticketMatched,
    order: orderSummary,
    returnRefund: ticketMismatch ? null : payload,
    suggestedTool: ticketMismatch ? 'getRefundStatus' : null,
    message: ticketMismatch
      ? `Don ${orderSummary.code} co yeu cau doi tra/hoan tien da ghi nhan, nhung khong khop ma ticket khach cung cap. Vui long kiem tra lai ticketId hoac ma don.`
      : `Yeu cau ${payload.requestTypeLabel || 'doi tra/hoan tien'}${payload.ticketId ? ` ${payload.ticketId}` : ''} cua don ${orderSummary.code} dang o trang thai: ${payload.statusLabel}.`
  }
}

async function resolveRefundStatusOrder(args = {}, context = {}) {
  const userId = normalizeUserId(context)
  const orderLookup = cleanString(args.orderId || args.orderCode)
  const ticketId = cleanString(args.ticketId)

  if (isMongoObjectId(userId)) {
    if (ticketId && !orderLookup) {
      const order = await orderRepository.findOne({
        userId,
        isDeleted: false,
        'returnRefund.ticketId': { $regex: `^${escapeRegExp(ticketId)}$`, $options: 'i' }
      })

      if (order) return { order, verifiedBy: 'account_ticket' }
    }

    if (!orderLookup) {
      const result = await ordersService.getMyOrders(userId)
      const orders = Array.isArray(result?.orders) ? result.orders.slice(0, 5) : []

      return {
        error: {
          found: orders.length > 0,
          requiresOrderSelection: true,
          message: orders.length > 0
            ? 'Vui long chon ma don hang can kiem tra trang thai doi tra/hoan tien.'
            : 'Tai khoan dang chat chua co don hang nao de kiem tra.',
          orders: orders.map(buildOrderSummaryPayload)
        }
      }
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return { error: { found: false, ...resolved.error } }

    const order = await orderRepository.findOne({
      _id: resolved.orderId,
      userId,
      isDeleted: false
    })

    if (!order) {
      return {
        error: {
          found: false,
          message: 'Khong tim thay don hang trong tai khoan dang chat.'
        }
      }
    }

    return { order, verifiedBy: 'account' }
  }

  const phone = normalizePhone(args.phone || context.customerInfo?.phone)

  if (ticketId && phone && !orderLookup) {
    const order = await orderRepository.findOne({
      'returnRefund.ticketId': { $regex: `^${escapeRegExp(ticketId)}$`, $options: 'i' },
      'contact.phone': phone,
      isDeleted: false
    })

    if (order) return { order, verifiedBy: 'ticket_phone' }
  }

  if (!orderLookup) {
    return {
      error: {
        found: false,
        requiresLogin: true,
        requiresOrder: true,
        message: 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de kiem tra trang thai doi tra/hoan tien.'
      }
    }
  }

  if (!phone) {
    return {
      error: {
        found: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai da dung khi dat hang de xac minh don hang.'
      }
    }
  }

  const query = {
    'contact.phone': phone,
    isDeleted: false
  }

  let order = null
  if (isMongoObjectId(orderLookup)) {
    order = await orderRepository.findOne({ ...query, _id: orderLookup })
  }

  if (!order) {
    order = await orderRepository.findOne({
      ...query,
      orderCode: { $regex: `^${escapeRegExp(orderLookup.replace(/^#/, ''))}$`, $options: 'i' }
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

  return { order, verifiedBy: 'order_code_phone' }
}

function buildReturnRequestMessage({
  args = {},
  order = {},
  requestType,
  preferredResolution,
  items = [],
  warnings = [],
  context = {}
} = {}) {
  const source = toPlainObject(order)
  const code = source.orderCode || formatOrderCode(source) || cleanString(args.orderCode || args.orderId)
  const orderItems = Array.isArray(source.orderItems) ? source.orderItems : []
  const selectedItems = items.length > 0
    ? items.map((item, index) => [
      `${index + 1}. ${item.name || item.productQuery || item.productId || 'San pham'}`,
      item.quantity ? `SL: ${item.quantity}` : null,
      item.reason ? `Ly do rieng: ${item.reason}` : null
    ].filter(Boolean).join(' | '))
    : ['Khach chua chi ro san pham; co the ap dung ca don hoac can nhan vien hoi them.']

  const orderItemPreview = orderItems.length > 0
    ? orderItems.slice(0, 8).map((item, index) =>
      `${index + 1}. ${item.name || 'San pham'} x${item.quantity || 1} - ${formatPrice(item.price ?? item.salePrice ?? 0)}`
    )
    : []

  return [
    `Loai yeu cau: ${RETURN_REQUEST_TYPE_LABELS[requestType] || requestType}`,
    `Huong xu ly mong muon: ${RETURN_RESOLUTION_LABELS[preferredResolution] || preferredResolution}`,
    `Ma don: ${code || '(khong co)'}`,
    `Trang thai don: ${source.status || '(khong ro)'} / thanh toan: ${source.paymentStatus || '(khong ro)'}`,
    source.total != null ? `Tong tien: ${formatPrice(source.total)}` : null,
    '',
    'San pham khach muon xu ly:',
    ...selectedItems,
    orderItemPreview.length > 0 ? '' : null,
    orderItemPreview.length > 0 ? 'San pham trong don (tham khao):' : null,
    ...orderItemPreview,
    '',
    `Ly do chinh: ${cleanString(args.reason)}`,
    cleanString(args.details) ? `Chi tiet: ${cleanString(args.details)}` : null,
    warnings.length > 0 ? `Can luu y: ${warnings.join(' | ')}` : null,
    cleanString(context.promptText) ? `Noi dung chat gan nhat: ${cleanString(context.promptText)}` : null
  ].filter(line => line !== null).join('\n')
}

function normalizeHandoffPriority(priority) {
  const normalized = cleanString(priority).toLowerCase()
  return HANDOFF_PRIORITIES.includes(normalized) ? normalized : 'normal'
}

function buildHandoffReason({ reason, summary, priority } = {}, context = {}) {
  const normalizedPriority = normalizeHandoffPriority(priority)
  const baseReason = truncateHandoffText(reason, 280)
    || truncateHandoffText(context.promptText, 180)
    || DEFAULT_HANDOFF_REASON
  const normalizedSummary = truncateHandoffText(summary, 180)
  const reasonParts = [baseReason]

  if (normalizedSummary) {
    reasonParts.push(`Context: ${normalizedSummary}`)
  }

  if (normalizedPriority !== 'normal') {
    reasonParts.push(`Priority: ${normalizedPriority}`)
  }

  return {
    escalationReason: truncateHandoffText(reasonParts.join(' | '), 500),
    priority: normalizedPriority,
    summary: normalizedSummary || null
  }
}

function buildHandoffResponse(args = {}, context = {}) {
  const { escalationReason, priority, summary } = buildHandoffReason(args, context)

  return JSON.stringify({
    success: true,
    handoffRequested: true,
    escalate: true,
    escalationReason,
    reason: escalationReason,
    summary,
    priority,
    message: HANDOFF_CUSTOMER_MESSAGE,
    nextAction: 'notify_support_agents'
  })
}

module.exports = {
  agentToolCallRepository,
  BUG_ISSUE_CATEGORY_MAP,
  BUG_ISSUE_SEVERITIES,
  BUG_ISSUE_TYPE_LABELS,
  BUG_ISSUE_TYPES,
  buildOrderSummaryPayload,
  CALLBACK_CONTACT_METHODS,
  cleanString,
  CLIENT_URL,
  DEFAULT_CALLBACK_TIMEZONE,
  DEFAULT_HANDOFF_REASON,
  escapeRegExp,
  findProductByQuery,
  formatDate,
  formatOrderCode,
  formatPrice,
  getGuideLocalizedRoot,
  getGuideText,
  HANDOFF_CUSTOMER_MESSAGE,
  HANDOFF_PRIORITIES,
  isMongoObjectId,
  logger,
  normalizePhone,
  normalizePolicyLanguage,
  normalizeSearchText,
  normalizeUserId,
  orderRepository,
  ordersService,
  parseToolPayload,
  pickString,
  productRepository,
  resolveOwnOrderId,
  RETURN_REFUND_STATUS_LABELS,
  RETURN_REFUND_STATUSES,
  RETURN_REFUND_SUB_STATUS_LABELS,
  RETURN_REFUND_SUB_STATUSES,
  RETURN_REQUEST_TYPE_LABELS,
  RETURN_REQUEST_TYPES,
  RETURN_RESOLUTION_LABELS,
  RETURN_RESOLUTIONS,
  serializeDate,
  serializeId,
  STORE_SOCIAL_MEDIA_FIELDS,
  SUPPORT_REQUEST_SOURCE_META,
  SUPPORT_REQUEST_SOURCE_TOOLS,
  SUPPORT_REQUEST_TYPE_TOOLS,
  SUPPORT_TICKET_ALREADY_CANCELLED_STATUSES,
  SUPPORT_TICKET_LOOKUP_SOURCE_TOOLS,
  SUPPORT_TICKET_NON_CANCELLABLE_STATUSES,
  SUPPORT_TICKET_SOURCE_META,
  SUPPORT_TICKET_SOURCE_TOOLS,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_UPDATE_TOOLS,
  toPlainObject,
  truncateHandoffText,
  WARRANTY_RESOLUTION_LABELS,
  WARRANTY_RESOLUTIONS,
  WARRANTY_STATUS_LABELS,
  websiteConfigRepository,
  getLocalizedWebsiteConfigText,
  buildStoreSocialMediaPayload,
  buildSupportChannelLinks,
  buildSupportInfoPayload,
  buildStoreLocationAddress,
  buildMapLinks,
  normalizeStoreLocation,
  getConfiguredStoreLocations,
  locationMatchesFilter,
  buildStoreLocationsPayload,
  buildContactRequestSummary,
  buildContactRequestResponse,
  buildSupportTicketResponse,
  normalizeSupportRequestType,
  normalizeSupportTicketId,
  getSupportTicketObject,
  extractSupportTicketPayload,
  normalizeSupportTicketUrlValue,
  normalizeSupportTicketUrlList,
  normalizeSupportTicketStatus,
  getSupportTicketStatusLabel,
  getSupportTicketContactSources,
  supportTicketEmailMatches,
  supportTicketPhoneMatches,
  isSupportTicketLookupVerified,
  findSupportTicketLog,
  findSupportTicketUpdateLogs,
  buildSupportTicketUpdatePayload,
  buildSupportTicketStatusResponse,
  addSupportTicketUpdatesToStatusResponse,
  isCreatedSupportRequest,
  buildSupportRequestCallbackPayload,
  buildSupportRequestOrderReference,
  buildSupportRequestListItem,
  isSupportTicketAlreadyCancelled,
  canCancelSupportTicketStatus,
  buildCancelledSupportTicketPayload,
  getSupportTicketContactValue,
  normalizeWarrantyResolution,
  normalizeWarrantyMediaUrls,
  getWarrantyOrderLookup,
  resolveWarrantyOrder,
  getWarrantyOrderItems,
  buildWarrantyOrderItemPayload,
  itemMatchesWarrantyLookup,
  selectWarrantyOrderItem,
  resolveWarrantyProduct,
  collectWarrantyPolicyTexts,
  parseWarrantyDuration,
  extractWarrantyPolicy,
  addDays,
  buildWarrantyWindow,
  resolveWarrantyStatus,
  buildWarrantyStatusPayload,
  buildWarrantyStatusMessage,
  getWarrantyRequestContact,
  buildWarrantySupportMessage,
  normalizeBugIssueType,
  normalizeBugIssueSeverity,
  normalizeBugReportStringList,
  getBugReportContact,
  buildBugReportMessage,
  buildBugReportResponse,
  normalizeCallbackContactMethod,
  isValidCallbackPhone,
  buildCallbackDetails,
  buildCallbackRequestMessage,
  buildScheduleCallbackResponse,
  normalizeReturnRequestType,
  normalizeReturnResolution,
  normalizeReturnRequestItems,
  getReturnRequestContact,
  resolveReturnRequestOrder,
  getReturnRequestWarnings,
  normalizeReturnRefundStatus,
  normalizeReturnRefundSubStatus,
  getReturnRefundRecord,
  hasReturnRefundRecord,
  sanitizeReturnRefundItemsForOrder,
  saveReturnRefundRequestStatus,
  getReturnRefundRecordPayload,
  buildNoReturnRefundRecordGuidance,
  buildReturnRefundStatusPayload,
  resolveRefundStatusOrder,
  buildReturnRequestMessage,
  normalizeHandoffPriority,
  buildHandoffReason,
  buildHandoffResponse
}










