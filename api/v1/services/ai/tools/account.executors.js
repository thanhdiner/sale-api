/**
 * AI tool executor implementations for the account domain.
 */

const {
  cleanString,
  CLIENT_URL,
  clientUserService,
  hasOwnProperty,
  isMongoObjectId,
  logger,
  maskEmail,
  normalizeIntentText,
  normalizePasswordResetEmail,
  normalizePhone,
  normalizeUserId,
  NOTIFICATION_CHANNEL_FIELDS,
  NOTIFICATION_TOPIC_FIELDS,
  notificationsService,
  PERSONAL_DATA_EXPORT_FORMATS,
  PERSONAL_DATA_EXPORT_SCOPES,
  pickString,
  serializeDate,
  serializeId,
  toPlainObject,
  truncateHandoffText,
  USER_PROFILE_MUTATION_FIELDS,
  userRepository
} = require('./tool.helpers')

function normalizeAccountDeletionContact(args = {}, user = {}, context = {}) {
  const contact = args.contact && typeof args.contact === 'object' ? args.contact : {}
  const customerInfo = context.customerInfo || {}
  const email = pickString(args.email, contact.email, user.email, customerInfo.email).toLowerCase()
  const phone = normalizePhone(pickString(args.phone, contact.phone, user.phone, customerInfo.phone))
  const preferredContactMethod = cleanString(args.preferredContactMethod || args.contactMethod).toLowerCase()

  return {
    name: pickString(args.name, args.fullName, contact.name, contact.fullName, user.fullName, customerInfo.name, user.username),
    email,
    phone,
    preferredContactMethod: ['email', 'phone', 'chat'].includes(preferredContactMethod)
      ? preferredContactMethod
      : (email ? 'email' : (phone ? 'phone' : 'chat'))
  }
}

function buildAccountDeletionMessage({ args = {}, user = {}, reason = '', context = {} } = {}) {
  const currentPage = cleanString(args.currentPage || context.customerInfo?.currentPage)

  return [
    'Loai yeu cau: Xoa tai khoan khach hang',
    `UserId: ${serializeId(user._id || user.id)}`,
    `Username: ${cleanString(user.username) || '(khong co)'}`,
    `Email tai khoan: ${cleanString(user.email) || '(khong co)'}`,
    `So dien thoai tai khoan: ${cleanString(user.phone) || '(khong co)'}`,
    `Trang thai tai khoan: ${cleanString(user.status) || '(khong ro)'}`,
    currentPage ? `Trang hien tai: ${currentPage}` : null,
    '',
    `Ly do/ghi chu cua khach: ${reason || 'Khach yeu cau xoa tai khoan qua chat.'}`,
    cleanString(args.details) ? `Chi tiet bo sung: ${cleanString(args.details)}` : null,
    '',
    'Khach da xac nhan gui yeu cau trong chat. Tool nay chi tao ticket, khong tu dong xoa tai khoan.',
    'Can nhan vien xac minh danh tinh, kiem tra nghia vu don hang/thanh toan va xu ly du lieu theo quy trinh truoc khi xoa.'
  ].filter(line => line !== null).join('\n')
}

function buildAccountDeletionResponse(result = {}, args = {}, meta = {}) {
  const request = result.request || {}
  const ticketId = result.ticketId || request.ticketId || null

  return {
    ...result,
    success: true,
    ticketCreated: true,
    accountDeletionRequested: true,
    accountDeleted: false,
    deletionScheduled: false,
    handoffRequested: false,
    escalate: false,
    ticketId,
    ticket: {
      ticketId,
      category: request.category || 'account',
      priority: request.priority || 'high',
      subject: request.subject || meta.subject || null,
      preferredContactMethod: request.preferredContactMethod || meta.contact?.preferredContactMethod || null,
      createdAt: request.createdAt || null
    },
    customer: {
      userId: serializeId(meta.user?._id || meta.user?.id),
      username: cleanString(meta.user?.username),
      email: cleanString(meta.user?.email),
      status: cleanString(meta.user?.status)
    },
    summary: meta.subject || 'Yeu cau xoa tai khoan',
    priority: request.priority || 'high',
    message: `Minh da ghi nhan yeu cau xoa tai khoan${ticketId ? ` ${ticketId}` : ''}. Nhan vien se xac minh va xu ly theo quy trinh; tai khoan chua bi xoa ngay trong chat.`,
    nextAction: 'account_deletion_follow_up'
  }
}

function buildUserProfileResponse(userValue = {}) {
  const user = toPlainObject(userValue)

  return {
    _id: serializeId(user._id || user.id),
    username: cleanString(user.username),
    fullName: cleanString(user.fullName),
    email: cleanString(user.email),
    phone: normalizePhone(user.phone),
    avatarUrl: cleanString(user.avatarUrl),
    status: cleanString(user.status),
    lastLogin: serializeDate(user.lastLogin),
    createdAt: serializeDate(user.createdAt),
    updatedAt: serializeDate(user.updatedAt)
  }
}

function normalizeUserProfileToolArgs(args = {}) {
  const source = args && typeof args === 'object' ? args : {}
  const nestedProfile = source.profile && typeof source.profile === 'object' ? source.profile : {}
  const payload = { ...nestedProfile }

  USER_PROFILE_MUTATION_FIELDS.forEach(field => {
    if (hasOwnProperty(source, field)) {
      payload[field] = source[field]
    }
  })

  return payload
}

function hasUserProfileMutationInput(payload = {}) {
  return USER_PROFILE_MUTATION_FIELDS.some(field => hasOwnProperty(payload, field))
}

function buildUserProfileUpdate(payload = {}) {
  const update = {}
  const invalidFields = []

  if (hasOwnProperty(payload, 'fullName')) {
    const fullName = cleanString(payload.fullName)
    if (!fullName) {
      invalidFields.push('fullName')
    } else {
      update.fullName = fullName
    }
  }

  if (hasOwnProperty(payload, 'phone')) {
    const phone = normalizePhone(payload.phone)
    if (phone && !/^[0-9]{9,15}$/.test(phone)) {
      invalidFields.push('phone')
    } else {
      update.phone = phone
    }
  }

  if (hasOwnProperty(payload, 'avatarUrl')) {
    update.avatarUrl = cleanString(payload.avatarUrl)
  }

  return { update, invalidFields }
}

function normalizeEmailChangeAddress(args = {}) {
  return cleanString(args.newEmail || args.email).toLowerCase()
}

function normalizeEmailChangeCode(args = {}) {
  return cleanString(args.code || args.otp)
}

function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanString(email))
}

function buildEmailChangeServiceResponse(result = {}, extra = {}) {
  const success = result.statusCode >= 200 && result.statusCode < 300

  return {
    success,
    ...extra,
    message: result.body?.message || (success
      ? 'Thao tac doi email thanh cong.'
      : 'Khong the thuc hien thao tac doi email luc nay.')
  }
}

function normalizePreferenceBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1
  const normalized = normalizeIntentText(value)
  if (['true', '1', 'yes', 'y', 'on', 'enable', 'enabled', 'bat'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off', 'disable', 'disabled', 'tat'].includes(normalized)) return false
  return null
}

function normalizeNotificationPreferencesForTool(preferences = {}) {
  const channels = preferences?.channels || {}

  return {
    channels: {
      inApp: channels.inApp !== false,
      email: channels.email !== false,
      browser: channels.browser !== false,
      sms: channels.sms === true
    },
    orderUpdates: preferences.orderUpdates !== false,
    paymentUpdates: preferences.paymentUpdates !== false,
    promotions: preferences.promotions !== false,
    backInStock: preferences.backInStock !== false,
    wishlistUpdates: preferences.wishlistUpdates !== false,
    supportMessages: preferences.supportMessages !== false
  }
}

function normalizeNotificationPreferenceArgs(args = {}) {
  const source = args?.preferences && typeof args.preferences === 'object'
    ? { ...args.preferences, ...args }
    : args
  const channelSource = {
    ...(source?.channels && typeof source.channels === 'object' ? source.channels : {}),
    ...NOTIFICATION_CHANNEL_FIELDS.reduce((result, field) => {
      if (hasOwnProperty(source, field)) result[field] = source[field]
      return result
    }, {})
  }
  const payload = { channels: {} }

  NOTIFICATION_CHANNEL_FIELDS.forEach(field => {
    if (!hasOwnProperty(channelSource, field)) return
    const normalized = normalizePreferenceBoolean(channelSource[field])
    if (normalized !== null) payload.channels[field] = normalized
  })

  NOTIFICATION_TOPIC_FIELDS.forEach(field => {
    if (!hasOwnProperty(source, field)) return
    const normalized = normalizePreferenceBoolean(source[field])
    if (normalized !== null) payload[field] = normalized
  })

  return payload
}

function hasNotificationPreferencesMutationInput(payload = {}) {
  return NOTIFICATION_TOPIC_FIELDS.some(field => hasOwnProperty(payload, field))
    || NOTIFICATION_CHANNEL_FIELDS.some(field => hasOwnProperty(payload.channels, field))
}

function buildNotificationPreferencesUpdate(payload = {}, currentPreferences = {}) {
  const current = normalizeNotificationPreferencesForTool(currentPreferences)
  const channels = { ...current.channels }

  NOTIFICATION_CHANNEL_FIELDS.forEach(field => {
    if (hasOwnProperty(payload.channels, field)) channels[field] = payload.channels[field]
  })

  const nextPreferences = {
    ...current,
    channels
  }

  NOTIFICATION_TOPIC_FIELDS.forEach(field => {
    if (hasOwnProperty(payload, field)) nextPreferences[field] = payload[field]
  })

  return nextPreferences
}

function buildNotificationPreferencesResponse(userValue = {}) {
  const user = toPlainObject(userValue)

  return {
    notificationPreferences: normalizeNotificationPreferencesForTool(user.notificationPreferences || {})
  }
}

function normalizePersonalDataExportScopes(value) {
  const rawItems = Array.isArray(value)
    ? value
    : (cleanString(value) ? cleanString(value).split(/[,;|]/) : ['all'])
  const scopes = rawItems
    .map(item => cleanString(item).toLowerCase())
    .filter(item => PERSONAL_DATA_EXPORT_SCOPES.includes(item))

  return scopes.length === 0 || scopes.includes('all')
    ? ['all']
    : [...new Set(scopes)]
}

function normalizePersonalDataExportFormat(value) {
  const normalized = cleanString(value).toLowerCase()
  return PERSONAL_DATA_EXPORT_FORMATS.includes(normalized) ? normalized : 'json'
}

function buildPersonalDataExportMessage({ user, scopes, format, reason, context } = {}) {
  const profile = user?.checkoutProfile || {}

  return [
    'Yeu cau xuat du lieu ca nhan tu chatbot.',
    `User ID: ${serializeId(user?._id || user?.id)}`,
    `Username: ${cleanString(user?.username) || '(khong co)'}`,
    `Email tai khoan: ${cleanString(user?.email) || '(khong co)'}`,
    `Ho ten: ${cleanString(user?.fullName || profile.firstName || context.customerInfo?.name) || '(khong co)'}`,
    `So dien thoai: ${normalizePhone(user?.phone || profile.phone || context.customerInfo?.phone) || '(khong co)'}`,
    `Pham vi du lieu: ${scopes.join(', ')}`,
    `Dinh dang mong muon: ${format}`,
    cleanString(reason) ? `Ly do/ghi chu: ${truncateHandoffText(reason, 500)}` : null,
    '',
    'Luu y bao mat: khong gui du lieu ca nhan truc tiep trong chat; chi xu ly qua email tai khoan sau khi nhan vien xac minh.'
  ].filter(line => line !== null).join('\n')
}

function buildPersonalDataExportResponse(result = {}, { scopes, format, deliveryEmail } = {}) {
  const request = result.request || {}

  return {
    ...result,
    ticketCreated: true,
    personalDataExportRequested: true,
    handoffRequested: false,
    escalate: false,
    requestType: 'personal_data_export',
    scopes,
    format,
    deliveryEmailMasked: maskEmail(deliveryEmail),
    ticket: {
      ticketId: result.ticketId || request.ticketId || null,
      category: request.category || 'account',
      priority: request.priority || 'normal',
      subject: request.subject || 'Yeu cau xuat du lieu ca nhan',
      preferredContactMethod: request.preferredContactMethod || 'email',
      createdAt: request.createdAt || null
    },
    summary: request.subject || 'Yeu cau xuat du lieu ca nhan',
    priority: request.priority || 'normal',
    message: `Minh da tao yeu cau xuat du lieu ca nhan ${result.ticketId}. De bao mat, nhan vien se xac minh va phan hoi qua email tai khoan ${maskEmail(deliveryEmail)}; minh khong hien thi du lieu ca nhan truc tiep trong chat.`,
    nextAction: 'personal_data_export_follow_up'
  }
}

async function getUserProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem thong tin ho so.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: '_id username fullName email phone avatarUrl status lastLogin createdAt updatedAt',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      found: true,
      message: 'Da lay thong tin ho so co ban.',
      profile: buildUserProfileResponse(user)
    })
  } catch (err) {
    logger.error('[AI Tool] getUserProfile error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay thong tin ho so.' })
  }
}

async function requestPasswordReset(args = {}, context = {}) {
  try {
    const sensitiveFields = ['password', 'newPassword', 'confirmPassword', 'currentPassword', 'code', 'otp']
      .filter(field => cleanString(args?.[field]))
    if (sensitiveFields.length > 0) {
      return JSON.stringify({
        success: false,
        rejectedSensitiveInput: true,
        sensitiveFields,
        message: 'Khong nhan mat khau, ma OTP hoac ma xac thuc trong chat. Vui long dung trang quen mat khau an toan.'
      })
    }

    const email = normalizePasswordResetEmail(args.email || args.accountEmail || context.customerInfo?.email)
    if (!email) {
      return JSON.stringify({
        success: false,
        missingFields: ['email'],
        message: 'Can email tai khoan de gui huong dan dat lai mat khau.'
      })
    }

    const result = await clientUserService.forgotPassword(email)
    const statusCode = Number(result?.statusCode || 500)

    if (statusCode >= 500) {
      return JSON.stringify({
        success: false,
        email,
        resetPageUrl: `${CLIENT_URL}/user/forgot-password`,
        message: 'Chua gui duoc email dat lai mat khau luc nay. Vui long thu lai sau hoac lien he nhan vien ho tro.'
      })
    }

    return JSON.stringify({
      success: true,
      email,
      resetRequested: true,
      accountExistsDisclosed: false,
      resetPageUrl: `${CLIENT_URL}/user/forgot-password`,
      message: 'Neu email nay khop voi tai khoan, he thong se gui ma xac thuc dat lai mat khau. Vui long kiem tra hop thu va hoan tat tren trang quen mat khau.',
      nextSteps: [
        'Mo trang quen mat khau.',
        'Nhap email va ma xac thuc nhan qua email.',
        'Dat mat khau moi tren form bao mat, khong gui mat khau trong chat.'
      ]
    })
  } catch (err) {
    logger.error('[AI Tool] requestPasswordReset error:', err.message)
    return JSON.stringify({
      success: false,
      resetPageUrl: `${CLIENT_URL}/user/forgot-password`,
      message: 'Loi khi khoi tao dat lai mat khau. Vui long thu lai tren trang quen mat khau hoac lien he nhan vien.'
    })
  }
}

async function getNotificationPreferences(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem tuy chon thong bao.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'notificationPreferences',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      found: true,
      message: 'Da lay tuy chon thong bao.',
      ...buildNotificationPreferencesResponse(user)
    })
  } catch (err) {
    logger.error('[AI Tool] getNotificationPreferences error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay tuy chon thong bao.' })
  }
}

async function listNotifications(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem thong bao.'
      })
    }

    const result = await notificationsService.listNotifications(userId, {
      status: args.status,
      category: args.category,
      limit: args.limit,
      unreadOnly: args.unreadOnly
    })

    return JSON.stringify({
      ...result,
      message: result.found
        ? `Da lay ${result.count} thong bao.`
        : 'Chua co thong bao phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] listNotifications error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the lay danh sach thong bao.',
      error: 'Loi khi lay thong bao.'
    })
  }
}

async function markNotificationRead(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de danh dau thong bao da doc.'
      })
    }

    const result = await notificationsService.markNotificationRead(userId, {
      notificationId: args.notificationId || args.id,
      notificationIds: args.notificationIds || args.ids,
      all: args.all === true || args.markAll === true
    })
    const unreadResult = await notificationsService.listNotifications(userId, {
      status: 'unread',
      limit: 1
    })

    return JSON.stringify({
      ...result,
      unreadCount: unreadResult.unreadCount,
      message: result.all
        ? `Da danh dau ${result.modifiedCount} thong bao la da doc.`
        : 'Da danh dau thong bao la da doc.'
    })
  } catch (err) {
    logger.error('[AI Tool] markNotificationRead error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the danh dau thong bao da doc.',
      error: 'Loi khi danh dau thong bao da doc.'
    })
  }
}

async function updateUserProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi cap nhat ho so.'
      })
    }

    const payload = normalizeUserProfileToolArgs(args)
    if (!hasUserProfileMutationInput(payload)) {
      return JSON.stringify({
        success: false,
        message: 'Chua co thong tin ho so nao de cap nhat.'
      })
    }

    const { update, invalidFields } = buildUserProfileUpdate(payload)
    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidFields,
        message: 'Thong tin ho so chua hop le, vui long kiem tra lai ho ten hoac so dien thoai.'
      })
    }

    const updatedUser = await userRepository.updateById(userId, update, {
      new: true,
      runValidators: true
    })
    if (!updatedUser) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      success: true,
      message: 'Da cap nhat ho so khach hang.',
      profile: buildUserProfileResponse(updatedUser)
    })
  } catch (err) {
    logger.error('[AI Tool] updateUserProfile error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat thong tin ho so.' })
  }
}

async function requestEmailChange(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi doi email.'
      })
    }

    const email = normalizeEmailChangeAddress(args)
    if (!isValidEmailAddress(email)) {
      return JSON.stringify({
        success: false,
        invalidFields: ['email'],
        message: 'Email moi khong hop le.'
      })
    }

    const result = await clientUserService.requestEmailUpdate(userId, email)

    return JSON.stringify(buildEmailChangeServiceResponse(result, {
      email,
      otpSent: result.statusCode >= 200 && result.statusCode < 300,
      expiresInMinutes: 3,
      nextTool: 'verifyEmailChange'
    }))
  } catch (err) {
    logger.error('[AI Tool] requestEmailChange error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi gui OTP doi email.' })
  }
}

async function verifyEmailChange(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xac minh doi email.'
      })
    }

    const email = normalizeEmailChangeAddress(args)
    const code = normalizeEmailChangeCode(args)
    const invalidFields = []

    if (!isValidEmailAddress(email)) invalidFields.push('email')
    if (!/^\d{6}$/.test(code)) invalidFields.push('code')

    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidFields,
        message: 'Email moi hoac ma OTP khong hop le.'
      })
    }

    const result = await clientUserService.confirmEmailUpdate(userId, { email, code })
    const success = result.statusCode >= 200 && result.statusCode < 300

    return JSON.stringify(buildEmailChangeServiceResponse(result, {
      email,
      emailChanged: success,
      profile: success && result.body?.data ? buildUserProfileResponse(result.body.data) : null
    }))
  } catch (err) {
    logger.error('[AI Tool] verifyEmailChange error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xac minh doi email.' })
  }
}

async function requestAccountDeletion(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi gui yeu cau xoa tai khoan.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: '_id username fullName email phone status deleted deletedAt',
      lean: true
    })
    if (!user || user.deleted === true) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang dang hoat dong de gui yeu cau xoa.'
      })
    }

    const contactService = require('../../client/cms/contact.service')
    const contact = normalizeAccountDeletionContact(args, user, context)
    const reason = truncateHandoffText(
      pickString(args.reason, args.details, args.message, context.promptText) || 'Khach yeu cau xoa tai khoan qua chat.',
      800
    )
    const subject = truncateHandoffText(
      `[Yeu cau xoa tai khoan] ${cleanString(user.username) || cleanString(user.email) || userId}`,
      180
    )
    const message = buildAccountDeletionMessage({ args, user, reason, context })
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      category: 'account',
      priority: 'high',
      currentPage: cleanString(args.currentPage || context.customerInfo?.currentPage),
      source: 'chatbot_account_deletion_request'
    }, {
      ...context,
      source: 'chatbot_account_deletion_request'
    })

    return JSON.stringify(buildAccountDeletionResponse(result, args, {
      user,
      contact,
      subject
    }))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestAccountDeletion validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        accountDeletionRequested: false,
        handoffRequested: false,
        escalate: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'ACCOUNT_DELETION_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestAccountDeletion error:', err.message)
    return JSON.stringify({
      success: false,
      ticketCreated: false,
      accountDeletionRequested: false,
      handoffRequested: false,
      escalate: false,
      message: 'Minh chua tao duoc yeu cau xoa tai khoan luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
      error: 'ACCOUNT_DELETION_REQUEST_FAILED'
    })
  }
}

async function updateNotificationPreferences(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi luu tuy chon thong bao.'
      })
    }

    const payload = normalizeNotificationPreferenceArgs(args)
    if (!hasNotificationPreferencesMutationInput(payload)) {
      return JSON.stringify({
        success: false,
        message: 'Chua co tuy chon thong bao hop le nao de cap nhat.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'notificationPreferences',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    const notificationPreferences = buildNotificationPreferencesUpdate(payload, user.notificationPreferences || {})
    const updatedUser = await userRepository.updateById(
      userId,
      { notificationPreferences },
      { new: true }
    )
    if (!updatedUser) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      success: true,
      message: 'Da luu tuy chon thong bao.',
      ...buildNotificationPreferencesResponse(updatedUser)
    })
  } catch (err) {
    logger.error('[AI Tool] updateNotificationPreferences error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat tuy chon thong bao.' })
  }
}

async function requestPersonalDataExport(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de tao yeu cau xuat du lieu ca nhan.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'username email fullName phone checkoutProfile',
      lean: true
    })

    if (!user) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khong tim thay tai khoan dang dang nhap de tao yeu cau xuat du lieu.'
      })
    }

    const deliveryEmail = normalizePasswordResetEmail(user.email)
    if (!deliveryEmail) {
      return JSON.stringify({
        success: false,
        requiresEmail: true,
        message: 'Tai khoan chua co email hop le. Vui long cap nhat/xac minh email truoc khi yeu cau xuat du lieu ca nhan.'
      })
    }

    const scopes = normalizePersonalDataExportScopes(args.scopes || args.scope)
    const format = normalizePersonalDataExportFormat(args.format)
    const reason = truncateHandoffText(args.reason || args.notes || args.message, 500)
    const contactService = require('../../client/cms/contact.service')
    const result = await contactService.submitContactRequest({
      name: user.fullName || context.customerInfo?.name || user.username,
      email: deliveryEmail,
      phone: normalizePhone(user.phone || user.checkoutProfile?.phone || context.customerInfo?.phone),
      preferredContactMethod: 'email',
      category: 'account',
      priority: 'normal',
      subject: 'Yeu cau xuat du lieu ca nhan',
      message: buildPersonalDataExportMessage({
        user,
        scopes,
        format,
        reason,
        context
      }),
      source: 'chatbot_personal_data_export'
    }, {
      ...context,
      source: 'chatbot_personal_data_export',
      userId
    })

    return JSON.stringify(buildPersonalDataExportResponse(result, {
      scopes,
      format,
      deliveryEmail
    }))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestPersonalDataExport validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        personalDataExportRequested: false,
        message: err.message,
        error: 'PERSONAL_DATA_EXPORT_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestPersonalDataExport error:', err.message)

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      personalDataExportRequested: false,
      message: 'Minh chua tao duoc yeu cau xuat du lieu ca nhan luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'PERSONAL_DATA_EXPORT_REQUEST_FAILED'
    })
  }
}

module.exports = {
  getUserProfile,
  requestPasswordReset,
  getNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateUserProfile,
  requestEmailChange,
  verifyEmailChange,
  requestAccountDeletion,
  updateNotificationPreferences,
  requestPersonalDataExport
}












