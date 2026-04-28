const {
  BUG_ISSUE_CATEGORY_MAP,
  BUG_ISSUE_TYPE_LABELS,
  cleanString,
  logger,
  pickString,
  truncateHandoffText,
  buildContactRequestResponse,
  normalizeBugIssueType,
  normalizeBugIssueSeverity,
  getBugReportContact,
  buildBugReportMessage,
  buildBugReportResponse,
  isValidCallbackPhone,
  buildCallbackDetails,
  buildCallbackRequestMessage,
  buildScheduleCallbackResponse,
  normalizeHandoffPriority
} = require('./support.helpers')

async function submitContactRequest(args = {}, context = {}) {
  try {
    const contactService = require('../../../client/contact.service')
    const result = await contactService.submitContactRequest(args, {
      ...context,
      source: 'chatbot'
    })

    return JSON.stringify(buildContactRequestResponse(result, args))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] submitContactRequest validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        found: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'CONTACT_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] submitContactRequest error:', err.message)

    const fallbackReason = truncateHandoffText(
      `Contact request failed: ${cleanString(args.subject || context.promptText || 'Yeu cau lien he')}`,
      500
    )

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      handoffRequested: true,
      escalate: true,
      escalationReason: fallbackReason,
      reason: fallbackReason,
      summary: cleanString(args.message || context.promptText, 180) || null,
      priority: args.priority || 'normal',
      message: 'Minh chua tao duoc ticket email luc nay, nhung da chuyen thong tin sang nhan vien ho tro trong chat.',
      nextAction: 'notify_support_agents',
      error: 'CONTACT_REQUEST_FAILED'
    })
  }
}

async function scheduleCallback(args = {}, context = {}) {
  try {
    const callback = buildCallbackDetails(args, context)

    if (!callback.phone) {
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai de nhan vien goi lai.',
        error: 'CALLBACK_PHONE_REQUIRED'
      })
    }

    if (!isValidCallbackPhone(callback.phone)) {
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresPhone: true,
        message: 'So dien thoai goi lai chua hop le. Vui long cung cap so co 8-15 chu so.',
        error: 'CALLBACK_PHONE_INVALID'
      })
    }

    if (!callback.hasRequestedTime) {
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresCallbackTime: true,
        message: 'Vui long cho biet ngay, gio hoac khung gio muon nhan vien goi lai.',
        error: 'CALLBACK_TIME_REQUIRED'
      })
    }

    const contactService = require('../../../client/contact.service')
    const priority = normalizeHandoffPriority(args.priority)
    const subject = truncateHandoffText(
      pickString(args.subject) || `Dat lich goi lai: ${callback.reason}`,
      200
    )
    const result = await contactService.submitContactRequest({
      name: callback.name,
      email: callback.email,
      phone: callback.phone,
      preferredContactMethod: callback.preferredContactMethod,
      category: 'general',
      subject,
      message: buildCallbackRequestMessage(callback, context),
      priority,
      source: 'chatbot_callback'
    }, {
      ...context,
      source: 'chatbot_callback'
    })

    return JSON.stringify(buildScheduleCallbackResponse(result, callback, priority))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] scheduleCallback validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresPhone: /so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'CALLBACK_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] scheduleCallback error:', err.message)

    const fallbackReason = truncateHandoffText(
      `Callback schedule failed: ${pickString(args.reason, args.subject, context.promptText, 'Dat lich goi lai')}`,
      500
    )

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      callbackScheduled: false,
      handoffRequested: true,
      escalate: true,
      escalationReason: fallbackReason,
      reason: fallbackReason,
      summary: truncateHandoffText(pickString(args.reason, context.promptText), 180) || null,
      priority: args.priority || 'normal',
      message: 'Minh chua tao duoc lich goi lai luc nay, nhung da chuyen thong tin sang nhan vien ho tro trong chat.',
      nextAction: 'notify_support_agents',
      error: 'CALLBACK_SCHEDULE_FAILED'
    })
  }
}

async function reportBugOrIssue(args = {}, context = {}) {
  try {
    const description = cleanString(args.description || args.details || args.message)
    if (!description) {
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        bugReportCreated: false,
        requiresDescription: true,
        handoffRequested: false,
        escalate: false,
        message: 'Vui long cung cap mo ta loi/su co truoc khi tao bao cao.'
      })
    }

    const issueType = normalizeBugIssueType(args.issueType || args.type, `${description} ${context.promptText || ''}`)
    const severity = normalizeBugIssueSeverity(args.severity || args.priority, issueType)
    const category = BUG_ISSUE_CATEGORY_MAP[issueType] || 'technical'
    const title = cleanString(args.title || args.subject)
    const subject = truncateHandoffText(
      `[${BUG_ISSUE_TYPE_LABELS[issueType] || 'Su co'}] ${title || description}`,
      180
    )
    const contact = getBugReportContact(args, context)
    const currentPage = cleanString(args.currentPage || args.pageUrl || context.customerInfo?.currentPage)
    const message = buildBugReportMessage({
      args,
      issueType,
      severity,
      category,
      description,
      context
    })

    const contactService = require('../../../client/contact.service')
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      category,
      priority: severity,
      preferredContactMethod: contact.preferredContactMethod || 'chat',
      currentPage,
      source: 'chatbot_bug_report'
    }, {
      ...context,
      source: 'chatbot_bug_report'
    })

    return JSON.stringify(buildBugReportResponse(result, args, {
      issueType,
      severity,
      category,
      subject
    }))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] reportBugOrIssue validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        bugReportCreated: false,
        handoffRequested: false,
        escalate: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'BUG_REPORT_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] reportBugOrIssue error:', err.message)

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      bugReportCreated: false,
      handoffRequested: false,
      escalate: false,
      message: 'Minh chua tao duoc bao cao loi/su co luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'BUG_REPORT_CREATE_FAILED'
    })
  }
}

module.exports = {
  submitContactRequest,
  scheduleCallback,
  reportBugOrIssue
}
