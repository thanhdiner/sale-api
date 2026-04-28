/**
 * AI tool executor implementations for the order domain.
 */

const {
  buildCartSnapshot,
  buildOrderItemPayload,
  buildOrderPayload,
  buildOrderSummaryPayload,
  buildPromoPayload,
  calculateEffectiveProductPrice,
  CHECKOUT_PROFILE_ADDRESS_FIELDS,
  CHECKOUT_PROFILE_DELIVERY_METHODS,
  CHECKOUT_PROFILE_MUTATION_FIELDS,
  CHECKOUT_PROFILE_PAYMENT_METHODS,
  CHECKOUT_PROFILE_STRING_FIELDS,
  cleanString,
  CLIENT_URL,
  createOnlinePaymentRequest,
  DEFAULT_SHIPPING_FEE,
  digitalDeliveryTemplate,
  ensureOrderCanResumePayment,
  formatOrderCode,
  formatPrice,
  FREE_SHIPPING_THRESHOLD,
  getActiveBankInfoPayload,
  getOrderObject,
  getOrderPaymentReference,
  hasOwnProperty,
  isMongoObjectId,
  isSellableProduct,
  logger,
  maskEmail,
  normalizeEnum,
  normalizeIntentText,
  normalizePasswordResetEmail,
  normalizePhone,
  normalizeQuantity,
  normalizeStructuredAddress,
  normalizeUserId,
  ORDER_ADDRESS_FIELDS,
  ORDER_STATUS_LABELS,
  orderConfirmedTemplate,
  orderRepository,
  ordersService,
  parseToolPayload,
  PAYMENT_STATUS_LABELS,
  pickString,
  PLACE_ORDER_DELIVERY_METHODS,
  PLACE_ORDER_PAYMENT_METHODS,
  productRepository,
  resolveOwnedOrderForPayment,
  resolveOwnOrderId,
  resolveProductForCartInput,
  sendMail,
  serializeId,
  toPlainObject,
  userRepository
} = require('./tool.helpers')

function normalizeOnlinePaymentMethod(value) {
  const normalized = normalizeIntentText(value)
  if (['card', 'the', 'atm', 'visa', 'mastercard', 'credit', 'debit'].includes(normalized)) {
    return 'vnpay'
  }

  return PLACE_ORDER_PAYMENT_METHODS.includes(normalized) ? normalized : 'vnpay'
}

function splitFullName(fullName = '') {
  const parts = cleanString(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}

function buildOrderContact({ contact = {}, user = null } = {}) {
  const sourceContact = contact && typeof contact === 'object' ? contact : {}
  const profile = user?.checkoutProfile || {}
  const fallbackName = splitFullName(user?.fullName)

  return {
    firstName: pickString(sourceContact.firstName, profile.firstName, fallbackName.firstName),
    lastName: pickString(sourceContact.lastName, profile.lastName, fallbackName.lastName),
    phone: normalizePhone(pickString(sourceContact.phone, profile.phone, user?.phone)),
    email: pickString(sourceContact.email, profile.email, user?.email),
    addressLine1: pickString(sourceContact.addressLine1, profile.addressLine1),
    provinceCode: pickString(sourceContact.provinceCode, profile.provinceCode),
    provinceName: pickString(sourceContact.provinceName, profile.provinceName),
    districtCode: pickString(sourceContact.districtCode, profile.districtCode),
    districtName: pickString(sourceContact.districtName, profile.districtName),
    wardCode: pickString(sourceContact.wardCode, profile.wardCode),
    wardName: pickString(sourceContact.wardName, profile.wardName),
    address: pickString(sourceContact.address, profile.address),
    notes: pickString(sourceContact.notes, profile.notes)
  }
}

function normalizeCheckoutDeliveryMethod(value) {
  return normalizeEnum(normalizeIntentText(value), CHECKOUT_PROFILE_DELIVERY_METHODS, 'pickup')
}

function normalizeCheckoutPaymentMethod(value) {
  const normalized = normalizeIntentText(value)

  if (['card', 'the', 'atm', 'visa', 'mastercard', 'credit', 'debit'].includes(normalized)) {
    return 'vnpay'
  }

  if (['bank', 'banking', 'chuyen khoan', 'chuyen-khoan'].includes(normalized)) {
    return 'transfer'
  }

  if (['lien he', 'thoa thuan'].includes(normalized)) {
    return 'contact'
  }

  return CHECKOUT_PROFILE_PAYMENT_METHODS.includes(normalized) ? normalized : 'transfer'
}

function normalizeCheckoutProfileForTool(profile = {}) {
  const normalizedAddress = normalizeStructuredAddress(profile || {})

  return {
    firstName: cleanString(profile?.firstName),
    lastName: cleanString(profile?.lastName),
    phone: normalizePhone(profile?.phone),
    email: cleanString(profile?.email),
    ...normalizedAddress,
    notes: cleanString(profile?.notes),
    deliveryMethod: normalizeCheckoutDeliveryMethod(profile?.deliveryMethod),
    paymentMethod: normalizeCheckoutPaymentMethod(profile?.paymentMethod)
  }
}

function normalizeCheckoutProfileToolArgs(args = {}) {
  const source = args && typeof args === 'object' ? args : {}
  const nestedProfile = source.profile && typeof source.profile === 'object' ? source.profile : {}
  const payload = { ...nestedProfile }

  CHECKOUT_PROFILE_MUTATION_FIELDS.forEach(field => {
    if (hasOwnProperty(source, field)) {
      payload[field] = source[field]
    }
  })

  return payload
}

function hasCheckoutProfileMutationInput(payload = {}) {
  return CHECKOUT_PROFILE_MUTATION_FIELDS.some(field => hasOwnProperty(payload, field))
}

function getCheckoutProfileValue(payload, currentProfile, field) {
  return hasOwnProperty(payload, field) ? payload[field] : currentProfile[field]
}

function buildCheckoutProfileUpdate(payload = {}, currentProfile = {}) {
  const current = normalizeCheckoutProfileForTool(currentProfile)
  const addressInput = CHECKOUT_PROFILE_ADDRESS_FIELDS.reduce((result, field) => ({
    ...result,
    [field]: getCheckoutProfileValue(payload, current, field)
  }), {})
  const normalizedAddress = normalizeStructuredAddress(addressInput)

  return {
    firstName: cleanString(getCheckoutProfileValue(payload, current, 'firstName')),
    lastName: cleanString(getCheckoutProfileValue(payload, current, 'lastName')),
    phone: normalizePhone(getCheckoutProfileValue(payload, current, 'phone')),
    email: cleanString(getCheckoutProfileValue(payload, current, 'email')),
    ...normalizedAddress,
    notes: cleanString(getCheckoutProfileValue(payload, current, 'notes')),
    deliveryMethod: normalizeCheckoutDeliveryMethod(getCheckoutProfileValue(payload, current, 'deliveryMethod')),
    paymentMethod: normalizeCheckoutPaymentMethod(getCheckoutProfileValue(payload, current, 'paymentMethod'))
  }
}

function getInvalidCheckoutProfileFields(profile = {}) {
  const invalidFields = []
  const phone = cleanString(profile.phone)
  const email = cleanString(profile.email)

  if (phone && !/^[0-9]{9,15}$/.test(phone)) {
    invalidFields.push('phone')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalidFields.push('email')
  }

  return invalidFields
}

function hasCheckoutProfileData(profile = {}) {
  return [...CHECKOUT_PROFILE_STRING_FIELDS, ...CHECKOUT_PROFILE_ADDRESS_FIELDS]
    .some(field => Boolean(cleanString(profile[field])))
}

function buildCheckoutProfileResponse(userValue = {}) {
  const user = toPlainObject(userValue)
  const checkoutProfile = normalizeCheckoutProfileForTool(user.checkoutProfile || {})
  const contactPreview = buildOrderContact({ user: { ...user, checkoutProfile } })

  return {
    checkoutProfile,
    hasCheckoutProfile: hasCheckoutProfileData(checkoutProfile),
    contactPreview,
    missingContactFields: getMissingOrderContactFields(contactPreview),
    accountFallback: {
      fullName: cleanString(user.fullName),
      email: cleanString(user.email),
      phone: normalizePhone(user.phone)
    }
  }
}

function getMissingOrderContactFields(contact = {}) {
  return ['firstName', 'lastName', 'phone'].filter(field => !cleanString(contact[field]))
}

function getInvalidOrderContactFields(contact = {}) {
  const invalidFields = []
  const phone = cleanString(contact.phone)
  const email = cleanString(contact.email)

  if (phone && !/^[0-9]{9,15}$/.test(phone)) {
    invalidFields.push('phone')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalidFields.push('email')
  }

  return invalidFields
}

function normalizePlaceOrderItems({ items, productId, productQuery, quantity } = {}) {
  const rawItems = Array.isArray(items) && items.length > 0
    ? items
    : [{ productId, productQuery, quantity }]

  return rawItems
    .map(item => ({
      productId: cleanString(item?.productId),
      productQuery: cleanString(item?.productQuery),
      quantity: normalizeQuantity(item?.quantity, 1)
    }))
    .filter(item => (item.productId || item.productQuery) && item.quantity > 0)
}

function buildOrderItemFromProduct(product, quantity) {
  const unitPrice = calculateEffectiveProductPrice(product)

  return {
    productId: product._id.toString(),
    name: product.title,
    image: product.thumbnail,
    quantity,
    price: unitPrice,
    salePrice: unitPrice,
    isFlashSale: false,
    discountPercentage: product.discountPercentage || 0,
    slug: product.slug
  }
}

function buildOrderItemFromCartItem(item = {}) {
  return {
    productId: item.productId,
    name: item.name,
    image: item.image,
    quantity: item.quantity,
    price: item.unitPrice,
    salePrice: item.unitPrice,
    isFlashSale: item.isFlashSale,
    flashSaleId: item.flashSaleId || undefined,
    discountPercentage: item.discountPercentage,
    slug: item.slug
  }
}

async function buildDirectOrderItems(requestedItems = []) {
  if (!requestedItems.length) {
    return {
      error: {
        success: false,
        message: 'Chua co san pham cu the de dat hang.'
      }
    }
  }

  const groupedItems = new Map()

  for (const item of requestedItems) {
    const product = await resolveProductForCartInput(item)
    if (!isSellableProduct(product)) {
      return {
        error: {
          success: false,
          message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de dat hang.`
        }
      }
    }

    const productId = product._id.toString()
    const existing = groupedItems.get(productId)
    groupedItems.set(productId, {
      product,
      quantity: (existing?.quantity || 0) + item.quantity
    })
  }

  const orderItems = []
  for (const { product, quantity } of groupedItems.values()) {
    const stock = Number(product.stock || 0)
    if (stock <= 0) {
      return {
        error: {
          success: false,
          message: `${product.title} hien da het hang.`,
          stock
        }
      }
    }

    if (quantity > stock) {
      return {
        error: {
          success: false,
          message: `So luong yeu cau vuot ton kho hien co cua ${product.title}.`,
          stock
        }
      }
    }

    orderItems.push(buildOrderItemFromProduct(product, quantity))
  }

  return { orderItems }
}

async function buildCartOrderItems(userId, { promoCode } = {}) {
  const cart = await buildCartSnapshot(userId, { promoCode })
  if (cart.distinctItemCount === 0) {
    return {
      error: {
        success: false,
        message: 'Gio hang hien dang trong, chua co san pham de dat hang.'
      }
    }
  }

  if (cart.hasIssues) {
    return {
      error: {
        success: false,
        requiresCartFix: true,
        message: 'Gio hang hien co van de can xu ly truoc khi dat hang.',
        cart
      }
    }
  }

  return {
    cart,
    orderItems: cart.items.map(buildOrderItemFromCartItem)
  }
}

function calculateOrderItemsSubtotal(orderItems = []) {
  return orderItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
}

function normalizeShipping(shipping, subtotal) {
  const normalized = Number(shipping)
  if (Number.isFinite(normalized) && normalized >= 0) {
    return normalized
  }

  return Number(subtotal || 0) > FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE
}

function normalizeDeliverySubtotal(value) {
  if (value === undefined || value === null || value === '') return null
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null
}

function normalizeDeliveryEstimateDays(value) {
  if (value === undefined || value === null || value === '') return null
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized < 0) return null
  return Math.floor(normalized)
}

function formatDeliveryEtaLabel(days, deliveryType = 'manual') {
  if (deliveryType === 'instant_account') return 'Nhan ngay sau khi thanh toan/xac nhan.'
  if (days == null) return 'Lien he de xac nhan ETA.'
  if (days <= 0) return 'Trong ngay.'
  return days === 1 ? 'Du kien trong 1 ngay.' : `Du kien trong ${days} ngay.`
}

function buildDeliveryItemPayload(product, quantity = 1, { lineSubtotal = null, issues = [] } = {}) {
  const normalizedQuantity = normalizeQuantity(quantity, 1) || 1
  const stock = Number(product?.stock || 0)
  const deliveryType = cleanString(product?.deliveryType) || 'manual'
  const deliveryEstimateDays = normalizeDeliveryEstimateDays(product?.deliveryEstimateDays)
  const unitPrice = calculateEffectiveProductPrice(product)
  const normalizedLineSubtotal = normalizeDeliverySubtotal(lineSubtotal)
  const itemIssues = [...issues]
  const sellable = isSellableProduct(product)

  if (!sellable) {
    itemIssues.push({
      code: 'unavailable',
      message: 'San pham khong con ban tren he thong.'
    })
  } else {
    if (stock <= 0) {
      itemIssues.push({
        code: 'out_of_stock',
        message: 'San pham hien da het hang.'
      })
    }

    if (normalizedQuantity > stock) {
      itemIssues.push({
        code: 'quantity_exceeds_stock',
        message: `So luong yeu cau (${normalizedQuantity}) vuot ton kho hien co (${stock}).`
      })
    }
  }

  return {
    productId: product?._id?.toString() || null,
    slug: product?.slug || null,
    name: product?.title || 'San pham khong xac dinh',
    quantity: normalizedQuantity,
    stock,
    available: sellable && stock > 0 && normalizedQuantity <= stock,
    deliveryType,
    deliveryEstimateDays,
    deliveryEta: formatDeliveryEtaLabel(deliveryEstimateDays, deliveryType),
    deliveryInstructions: cleanString(product?.deliveryInstructions) || null,
    unitPrice,
    unitPriceFormatted: formatPrice(unitPrice),
    lineSubtotal: normalizedLineSubtotal != null ? normalizedLineSubtotal : unitPrice * normalizedQuantity,
    lineSubtotalFormatted: formatPrice(normalizedLineSubtotal != null ? normalizedLineSubtotal : unitPrice * normalizedQuantity),
    issues: itemIssues
  }
}

async function buildDeliveryItemsFromProductInputs(requestedItems = []) {
  const result = {
    items: [],
    missingItems: []
  }

  for (const item of requestedItems) {
    const product = await resolveProductForCartInput(item)
    if (!product) {
      result.missingItems.push({
        productId: item.productId || null,
        productQuery: item.productQuery || null,
        quantity: item.quantity,
        message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de xem ETA.`
      })
      continue
    }

    result.items.push(buildDeliveryItemPayload(product, item.quantity))
  }

  return result
}

async function buildDeliveryItemsFromCart(cart = {}) {
  if (!Array.isArray(cart.items) || cart.items.length === 0) return []

  const productIds = cart.items.map(item => item.productId).filter(Boolean)
  const products = await productRepository.findByQuery(
    { _id: { $in: productIds } },
    {
      select: 'title price discountPercentage stock thumbnail slug status deleted deliveryEstimateDays deliveryType deliveryInstructions',
      lean: true
    }
  )
  const productMap = new Map(products.map(product => [product._id.toString(), product]))

  return cart.items.map(item => {
    const product = productMap.get(item.productId) || null
    if (!product) {
      return {
        productId: item.productId,
        slug: item.slug || null,
        name: item.name || 'San pham khong xac dinh',
        quantity: item.quantity,
        stock: 0,
        available: false,
        deliveryType: null,
        deliveryEstimateDays: null,
        deliveryEta: 'Khong xac dinh.',
        deliveryInstructions: null,
        unitPrice: item.unitPrice,
        unitPriceFormatted: item.unitPriceFormatted,
        lineSubtotal: item.lineTotal,
        lineSubtotalFormatted: item.lineTotalFormatted,
        issues: [
          ...(Array.isArray(item.issues) ? item.issues : []),
          {
            code: 'unavailable',
            message: 'San pham khong con ban tren he thong.'
          }
        ]
      }
    }

    return buildDeliveryItemPayload(product, item.quantity, {
      lineSubtotal: item.lineTotal,
      issues: Array.isArray(item.issues) ? item.issues : []
    })
  })
}

function calculateDeliveryItemsSubtotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0)
}

function buildDeliveryEtaSummary(items = []) {
  const availableItems = items.filter(item => item.available)
  if (items.length === 0 || availableItems.length === 0) {
    return {
      type: 'default',
      label: 'Trong ngay voi pickup; tuy thoa thuan voi lien he.',
      minDays: 0,
      maxDays: 0,
      hasProductContext: items.length > 0,
      hasUnknownEta: false,
      hasInstantItems: false,
      hasManualItems: false
    }
  }

  const hasInstantItems = availableItems.some(item => item.deliveryType === 'instant_account')
  const hasManualItems = availableItems.some(item => item.deliveryType !== 'instant_account')
  const manualItems = availableItems.filter(item => item.deliveryType !== 'instant_account')
  const manualDays = manualItems
    .map(item => item.deliveryEstimateDays)
    .filter(days => Number.isFinite(days))
  const hasUnknownEta = manualItems.some(item => item.deliveryEstimateDays == null)
  const maxDays = manualDays.length > 0 ? Math.max(...manualDays) : 0

  if (!hasManualItems) {
    return {
      type: 'instant',
      label: 'Nhan ngay sau khi thanh toan/xac nhan.',
      minDays: 0,
      maxDays: 0,
      hasProductContext: true,
      hasUnknownEta: false,
      hasInstantItems,
      hasManualItems
    }
  }

  return {
    type: hasUnknownEta && maxDays === 0 ? 'contact_required' : 'estimated',
    label: hasUnknownEta && maxDays === 0
      ? 'Lien he de xac nhan ETA.'
      : formatDeliveryEtaLabel(maxDays, 'manual'),
    minDays: 0,
    maxDays: hasUnknownEta && maxDays === 0 ? null : maxDays,
    hasProductContext: true,
    hasUnknownEta,
    hasInstantItems,
    hasManualItems
  }
}

function buildDeliveryAvailability(items = []) {
  const unavailableItems = items
    .filter(item => !item.available)
    .map(item => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      stock: item.stock,
      issues: item.issues
    }))

  return {
    deliveryAvailable: unavailableItems.length === 0,
    unavailableItems
  }
}

function buildDeliveryMethodOptions({ eta, availability }) {
  const deliveryAvailable = availability.deliveryAvailable

  return [
    {
      id: 'pickup',
      name: 'Nhan hang/ban giao truc tiep',
      available: deliveryAvailable,
      eta: eta.label,
      etaDetails: eta,
      fee: 0,
      feeFormatted: formatPrice(0),
      description: 'Nhan tai cua hang hoac ban giao truc tiep theo thong tin don hang.'
    },
    {
      id: 'contact',
      name: 'Lien he de thoa thuan',
      available: deliveryAvailable,
      eta: 'Tuy thoa thuan.',
      etaDetails: {
        type: 'agreement',
        label: 'Tuy thoa thuan.',
        minDays: null,
        maxDays: null,
        referenceEta: eta
      },
      fee: 0,
      feeFormatted: formatPrice(0),
      description: 'Nhan/giao theo lich va phi thoa thuan voi nhan vien neu phat sinh.'
    }
  ]
}

function buildDeliveryShippingEstimate(subtotal) {
  if (subtotal == null) {
    return {
      available: false,
      requiresSubtotal: true,
      subtotal: null,
      subtotalFormatted: null,
      fee: null,
      feeFormatted: null,
      isFree: null,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      freeShippingThresholdFormatted: formatPrice(FREE_SHIPPING_THRESHOLD),
      defaultFee: DEFAULT_SHIPPING_FEE,
      defaultFeeFormatted: formatPrice(DEFAULT_SHIPPING_FEE),
      rule: `Mien phi neu tam tinh don hang > ${formatPrice(FREE_SHIPPING_THRESHOLD)}, nguoc lai ${formatPrice(DEFAULT_SHIPPING_FEE)}.`
    }
  }

  const fee = normalizeShipping(null, subtotal)

  return {
    available: true,
    requiresSubtotal: false,
    subtotal,
    subtotalFormatted: formatPrice(subtotal),
    fee,
    feeFormatted: formatPrice(fee),
    isFree: fee === 0,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    freeShippingThresholdFormatted: formatPrice(FREE_SHIPPING_THRESHOLD),
    defaultFee: DEFAULT_SHIPPING_FEE,
    defaultFeeFormatted: formatPrice(DEFAULT_SHIPPING_FEE),
    rule: `Mien phi neu tam tinh don hang > ${formatPrice(FREE_SHIPPING_THRESHOLD)}, nguoc lai ${formatPrice(DEFAULT_SHIPPING_FEE)}.`,
    source: 'checkout_default'
  }
}

function buildDeliveryOptionsMessage({ source, deliveryItems, missingItems, availability }) {
  if (missingItems.length > 0 && deliveryItems.length === 0) {
    return 'Khong tim thay san pham can xem ETA; da tra ve phuong thuc nhan hang/giao hang chung.'
  }

  if (!availability.deliveryAvailable) {
    return 'Da lay phuong thuc nhan hang/giao hang, nhung co san pham chua san sang de giao/nhan.'
  }

  if (source === 'current_cart') {
    return 'Da lay phuong thuc nhan hang/giao hang kha dung theo gio hang hien tai.'
  }

  if (source === 'product_input') {
    return 'Da lay phuong thuc nhan hang/giao hang kha dung theo san pham.'
  }

  return 'Da lay phuong thuc nhan hang/giao hang kha dung.'
}

function getOrderDocumentUrl(source = {}, type) {
  const document = source[type] && typeof source[type] === 'object' ? source[type] : {}

  return pickString(
    source[type],
    source[`${type}Url`],
    source[`${type}Link`],
    source[`${type}PdfUrl`],
    document.url,
    document.link,
    document.pdfUrl,
    document.downloadUrl
  )
}

function buildOrderInvoicePayload(order = {}) {
  const source = toPlainObject(order) || {}
  const orderSummary = buildOrderPayload(source)
  const invoiceUrl = getOrderDocumentUrl(source, 'invoice')
    || pickString(source.taxInvoiceUrl, source.vatInvoiceUrl)
  const receiptUrl = getOrderDocumentUrl(source, 'receipt')
    || pickString(source.paymentReceiptUrl)
  const orderDetailUrl = orderSummary.orderUrl
  const successUrl = orderSummary.id
    ? `${CLIENT_URL}/order-success?orderId=${orderSummary.id}${source.paymentMethod ? `&method=${source.paymentMethod}` : ''}`
    : null
  const instructions = []

  if (invoiceUrl) {
    instructions.push('Mo invoiceUrl de xem hoac tai hoa don cua don hang.')
  }

  if (receiptUrl) {
    instructions.push('Mo receiptUrl de xem hoac tai bien nhan thanh toan cua don hang.')
  }

  if (orderDetailUrl) {
    instructions.push('Neu chua co file hoa don rieng, mo orderDetailUrl de xem chi tiet don hang va dung chuc nang in/luu PDF cua trinh duyet lam bien nhan.')
  }

  if (source.paymentStatus && source.paymentStatus !== 'paid') {
    instructions.push('Don hang chua duoc ghi nhan da thanh toan; hoa don/bien nhan thanh toan co the chua kha dung.')
  }

  instructions.push('Neu can hoa don VAT hoac chung tu do cua hang phat hanh rieng, hay lien he nhan vien ho tro kem ma don hang.')

  return {
    found: true,
    invoiceAvailable: !!invoiceUrl,
    receiptAvailable: !!receiptUrl || !!orderDetailUrl,
    hasGeneratedInvoice: !!invoiceUrl,
    hasGeneratedReceipt: !!receiptUrl,
    message: invoiceUrl
      ? 'Da tim thay link hoa don cua don hang.'
      : 'Hien tai he thong chua co file hoa don rieng cho don nay. Co the dung trang chi tiet don hang lam bien nhan va in/luu PDF neu can.',
    order: orderSummary,
    links: {
      invoiceUrl: invoiceUrl || null,
      receiptUrl: receiptUrl || null,
      orderDetailUrl,
      orderSuccessUrl: successUrl
    },
    instructions
  }
}

function buildOrderDetailPayload(order = {}) {
  const source = getOrderObject(order)
  const items = Array.isArray(source.orderItems) ? source.orderItems : []

  return {
    ...buildOrderSummaryPayload(source),
    items: items.map(buildOrderItemPayload),
    contact: {
      name: [source.contact?.firstName, source.contact?.lastName].filter(Boolean).join(' ').trim(),
      phone: source.contact?.phone || '',
      email: source.contact?.email || '',
      address: source.contact?.address || source.contact?.addressLine1 || '',
      notes: source.contact?.notes || ''
    },
    cancelledAt: source.cancelledAt || null,
    updatedAt: source.updatedAt || null
  }
}

async function resolveOwnedOrderForEmailResend({ userId, orderId, orderCode } = {}) {
  const hasLookup = !!cleanString(orderId || orderCode)

  if (hasLookup) {
    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return { error: { success: false, ...resolved.error } }

    const order = await orderRepository.findOne({
      _id: resolved.orderId,
      userId,
      isDeleted: false
    })

    if (!order) {
      return {
        error: {
          success: false,
          found: false,
          message: 'Khong tim thay don hang trong tai khoan dang chat.'
        }
      }
    }

    return { order }
  }

  const result = await ordersService.getMyOrders(userId)
  const orders = Array.isArray(result?.orders) ? result.orders : []

  if (orders.length === 0) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Khong tim thay don hang nao trong tai khoan dang chat.'
      }
    }
  }

  if (orders.length > 1) {
    return {
      error: {
        success: false,
        requiresOrderSelection: true,
        message: 'Tim thay nhieu don hang. Vui long chon ma don can gui lai email.',
        orders: orders.slice(0, 5).map(order => buildOrderSummaryPayload(order))
      }
    }
  }

  const onlyOrderId = serializeId(orders[0]?._id || orders[0]?.id)
  const order = onlyOrderId
    ? await orderRepository.findOne({ _id: onlyOrderId, userId, isDeleted: false })
    : null

  if (!order) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Khong tim thay don hang trong tai khoan dang chat.'
      }
    }
  }

  return { order }
}

async function resolveOrderResendRecipient(order = {}, userId) {
  const source = getOrderObject(order)
  const orderEmail = normalizePasswordResetEmail(source.contact?.email)
  if (orderEmail) {
    return {
      email: orderEmail,
      maskedEmail: maskEmail(orderEmail),
      source: 'order_contact'
    }
  }

  const user = isMongoObjectId(userId)
    ? await userRepository.findEmailById(userId)
    : null
  const accountEmail = normalizePasswordResetEmail(user?.email)

  if (accountEmail) {
    return {
      email: accountEmail,
      maskedEmail: maskEmail(accountEmail),
      source: 'account'
    }
  }

  return null
}

function getDigitalDeliverySummary(order = {}) {
  const source = getOrderObject(order)
  const items = Array.isArray(source.orderItems) ? source.orderItems : []
  const deliveredItems = []
  let deliveryCount = 0

  for (const item of items) {
    const deliveries = Array.isArray(item.digitalDeliveries)
      ? item.digitalDeliveries.filter(delivery => {
          const data = getOrderObject(delivery)
          return ['username', 'password', 'email', 'licenseKey', 'loginUrl', 'notes', 'instructions']
            .some(field => cleanString(data[field]))
        })
      : []

    if (!deliveries.length) continue

    deliveryCount += deliveries.length
    deliveredItems.push({
      productId: serializeId(item.productId),
      name: item.name || 'San pham',
      deliveryCount: deliveries.length
    })
  }

  return {
    hasDigitalDelivery: deliveryCount > 0,
    deliveryCount,
    deliveredItems
  }
}

function buildEmailResendOrderPayload(order = {}) {
  const source = getOrderObject(order)
  const payload = buildOrderPayload(source)
  return {
    ...payload,
    statusLabel: ORDER_STATUS_LABELS[source.status] || source.status,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus,
    hasDigitalDelivery: !!source.hasDigitalDelivery || getDigitalDeliverySummary(source).hasDigitalDelivery
  }
}

function buildReorderItemsFromOrder(order = {}) {
  const source = getOrderObject(order)
  const items = Array.isArray(source.orderItems) ? source.orderItems : []

  return items
    .map(item => ({
      productId: serializeId(item.productId),
      quantity: normalizeQuantity(item.quantity, 1)
    }))
    .filter(item => item.productId && item.quantity > 0)
}

function normalizeReorderPaymentMethod(paymentMethod, sourcePaymentMethod) {
  const requestedPaymentMethod = cleanString(paymentMethod).toLowerCase()
  if (requestedPaymentMethod) {
    return requestedPaymentMethod === 'card' || PLACE_ORDER_PAYMENT_METHODS.includes(requestedPaymentMethod)
      ? requestedPaymentMethod
      : undefined
  }

  const previousPaymentMethod = cleanString(sourcePaymentMethod).toLowerCase()
  return PLACE_ORDER_PAYMENT_METHODS.includes(previousPaymentMethod)
    ? previousPaymentMethod
    : undefined
}

function buildReorderSelectionPayload(orders = []) {
  const recentOrders = orders.slice(0, 5)

  return {
    success: false,
    requiresOrderSelection: true,
    found: recentOrders.length > 0,
    message: recentOrders.length > 0
      ? 'Vui long chon ma don hang cu can dat lai.'
      : 'Tai khoan dang chat chua co don hang nao de dat lai.',
    orders: recentOrders.map(order => buildOrderSummaryPayload(order))
  }
}

function buildOrderAddressPatch(args = {}) {
  return ORDER_ADDRESS_FIELDS.reduce((patch, field) => {
    if (Object.prototype.hasOwnProperty.call(args, field)) {
      patch[field] = args[field]
    }

    return patch
  }, {})
}

function buildOrderContactPatch(args = {}) {
  const patch = {}

  if (Object.prototype.hasOwnProperty.call(args, 'phone')) {
    patch.phone = args.phone
  }
  if (Object.prototype.hasOwnProperty.call(args, 'email')) {
    patch.email = args.email
  }
  if (Object.prototype.hasOwnProperty.call(args, 'notes')) {
    patch.notes = args.notes
  }

  return patch
}

function normalizePendingOrderToolMode(value) {
  const normalized = cleanString(value).toLowerCase()
  return ['replace', 'update', 'add', 'remove'].includes(normalized) ? normalized : 'replace'
}

function normalizePendingOrderToolQuantity(value, {
  defaultQuantity = 1,
  allowZero = false,
  required = false
} = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? null : defaultQuantity
  }

  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized < 0) return null
  if (!allowZero && normalized < 1) return null

  return normalized
}

function normalizePendingOrderToolItem(item = {}, options = {}) {
  const source = item && typeof item === 'object' ? item : {}
  const productId = cleanString(source.productId || source.id)
  const productQuery = cleanString(
    source.productQuery
    || source.query
    || source.slug
    || source.name
    || source.title
  )
  const quantity = normalizePendingOrderToolQuantity(source.quantity, options)

  return {
    productId,
    productQuery,
    quantity
  }
}

function normalizePendingOrderToolItems(value, options = {}) {
  const rawItems = Array.isArray(value)
    ? value
    : (value && typeof value === 'object' ? [value] : [])

  return rawItems
    .map(item => normalizePendingOrderToolItem(item, options))
    .filter(item => item.productId || item.productQuery)
}

function getPendingOrderCurrentItemsMap(order = {}) {
  const source = getOrderObject(order)
  const currentItems = Array.isArray(source.orderItems) ? source.orderItems : []
  const map = new Map()

  currentItems.forEach(item => {
    const productId = serializeId(item.productId)
    const quantity = normalizeQuantity(item.quantity, 0)
    if (!productId || quantity < 1) return

    map.set(productId, { productId, quantity })
  })

  return map
}

function findPendingOrderCurrentProductId(order = {}, productQuery = '') {
  const query = cleanString(productQuery).toLowerCase()
  if (!query) return ''

  const source = getOrderObject(order)
  const currentItems = Array.isArray(source.orderItems) ? source.orderItems : []
  const match = currentItems.find(item => {
    const name = cleanString(item.name).toLowerCase()
    const slug = cleanString(item.slug).toLowerCase()
    const productId = serializeId(item.productId).toLowerCase()

    return query === name || query === slug || query === productId
  })

  return match ? serializeId(match.productId) : ''
}

async function resolvePendingOrderToolProductId(item = {}, order = {}) {
  if (isMongoObjectId(item.productId)) {
    if (getPendingOrderCurrentItemsMap(order).has(item.productId)) {
      return { productId: item.productId }
    }

    const product = await resolveProductForCartInput(item)
    if (!isSellableProduct(product)) {
      return {
        error: {
          success: false,
          message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de cap nhat don hang.`
        }
      }
    }

    return { productId: product._id.toString() }
  }

  const currentProductId = findPendingOrderCurrentProductId(order, item.productQuery)
  if (currentProductId) {
    return { productId: currentProductId }
  }

  const product = await resolveProductForCartInput(item)
  if (!isSellableProduct(product)) {
    return {
      error: {
        success: false,
        message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de cap nhat don hang.`
      }
    }
  }

  return { productId: product._id.toString() }
}

async function buildPendingOrderReplacementItems(rawItems = [], order = {}) {
  const itemsMap = new Map()

  for (const item of rawItems) {
    if (!item.quantity || item.quantity < 1) {
      return {
        error: {
          success: false,
          message: 'So luong san pham cap nhat phai lon hon 0.'
        }
      }
    }

    const resolved = await resolvePendingOrderToolProductId(item, order)
    if (resolved.error) return resolved

    const current = itemsMap.get(resolved.productId)
    itemsMap.set(resolved.productId, {
      productId: resolved.productId,
      quantity: (current?.quantity || 0) + item.quantity
    })
  }

  return { items: [...itemsMap.values()] }
}

async function applyPendingOrderItemSet(itemsMap, item = {}, order = {}) {
  if (item.quantity === null) {
    return {
      error: {
        success: false,
        message: 'Can cung cap so luong moi khi sua san pham trong don pending.'
      }
    }
  }

  const resolved = await resolvePendingOrderToolProductId(item, order)
  if (resolved.error) return resolved

  if (item.quantity === 0) {
    itemsMap.delete(resolved.productId)
  } else {
    itemsMap.set(resolved.productId, {
      productId: resolved.productId,
      quantity: item.quantity
    })
  }

  return {}
}

async function applyPendingOrderItemAdd(itemsMap, item = {}, order = {}) {
  if (!item.quantity || item.quantity < 1) {
    return {
      error: {
        success: false,
        message: 'Can cung cap so luong lon hon 0 khi them san pham vao don pending.'
      }
    }
  }

  const resolved = await resolvePendingOrderToolProductId(item, order)
  if (resolved.error) return resolved

  const current = itemsMap.get(resolved.productId)
  itemsMap.set(resolved.productId, {
    productId: resolved.productId,
    quantity: (current?.quantity || 0) + item.quantity
  })

  return {}
}

async function applyPendingOrderItemRemove(itemsMap, item = {}, order = {}) {
  const resolved = await resolvePendingOrderToolProductId(item, order)
  if (resolved.error) return resolved

  itemsMap.delete(resolved.productId)
  return {}
}

async function buildPendingOrderItemsUpdatePayload(args = {}, order = {}) {
  const mode = normalizePendingOrderToolMode(args.mode || args.operation)
  const replacementItems = normalizePendingOrderToolItems(args.items || args.orderItems, {
    defaultQuantity: 1,
    allowZero: false
  })

  if (replacementItems.length > 0 && mode === 'replace') {
    return buildPendingOrderReplacementItems(replacementItems, order)
  }

  const itemsMap = getPendingOrderCurrentItemsMap(order)
  let changed = false

  const modeItems = replacementItems.length > 0 ? replacementItems : []
  if (modeItems.length > 0) {
    const normalizedModeItems = mode === 'remove'
      ? normalizePendingOrderToolItems(args.items || args.orderItems, { defaultQuantity: null })
      : normalizePendingOrderToolItems(args.items || args.orderItems, {
        defaultQuantity: mode === 'add' ? 1 : null,
        allowZero: mode !== 'add',
        required: mode === 'update'
      })

    for (const item of normalizedModeItems) {
      const result = mode === 'add'
        ? await applyPendingOrderItemAdd(itemsMap, item, order)
        : (mode === 'remove'
            ? await applyPendingOrderItemRemove(itemsMap, item, order)
            : await applyPendingOrderItemSet(itemsMap, item, order))
      if (result.error) return result
      changed = true
    }
  }

  const updates = normalizePendingOrderToolItems(args.updates, {
    defaultQuantity: null,
    allowZero: true,
    required: true
  })
  for (const item of updates) {
    const result = await applyPendingOrderItemSet(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  const addItems = normalizePendingOrderToolItems(args.addItems, {
    defaultQuantity: 1,
    allowZero: false
  })
  for (const item of addItems) {
    const result = await applyPendingOrderItemAdd(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  const removeItems = normalizePendingOrderToolItems(args.removeItems, {
    defaultQuantity: null
  })
  for (const item of removeItems) {
    const result = await applyPendingOrderItemRemove(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  if (cleanString(args.productId || args.productQuery)) {
    const item = normalizePendingOrderToolItem(args, {
      defaultQuantity: null,
      allowZero: true,
      required: true
    })
    const result = await applyPendingOrderItemSet(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  if (!changed) {
    return {
      error: {
        success: false,
        message: 'Chua co thay doi san pham/so luong nao de cap nhat.'
      }
    }
  }

  const items = [...itemsMap.values()].filter(item => item.quantity > 0)
  if (items.length === 0) {
    return {
      error: {
        success: false,
        message: 'Don hang phai con it nhat mot san pham sau khi cap nhat.'
      }
    }
  }

  return { items }
}

function formatPendingOrderChangePrevious(previous = {}) {
  return {
    ...previous,
    subtotalFormatted: formatPrice(previous?.subtotal),
    discountFormatted: formatPrice(previous?.discount),
    shippingFormatted: formatPrice(previous?.shipping),
    totalFormatted: formatPrice(previous?.total)
  }
}

async function buildPendingOrderPaymentRefresh(order, userId) {
  const paymentReference = getOrderPaymentReference(order)
  const payment = await createOnlinePaymentRequest(
    order.paymentMethod,
    order._id.toString(),
    userId,
    paymentReference
  )

  if (order.paymentMethod === 'sepay') {
    payment.bankInfo = await getActiveBankInfoPayload({ order, paymentReference })
  }

  return payment
}

function normalizePendingOrderDeliveryMethod(value) {
  const normalized = normalizeIntentText(value)
  if (!normalized) return null
  if (['pickup', 'nhan', 'nhan hang', 'tu nhan', 'truc tiep', 'ban giao truc tiep'].includes(normalized)) return 'pickup'
  if (['contact', 'giao', 'giao hang', 'delivery', 'ship', 'shipping', 'lien he', 'thoa thuan'].includes(normalized)) return 'contact'
  return PLACE_ORDER_DELIVERY_METHODS.includes(normalized) ? normalized : null
}

function getDeliveryMethodLabel(deliveryMethod) {
  if (deliveryMethod === 'pickup') return 'Nhan hang/ban giao truc tiep'
  if (deliveryMethod === 'contact') return 'Lien he de thoa thuan giao/ban giao'
  return deliveryMethod || null
}

function formatPendingOrderDeliveryPrevious(previous = {}) {
  return {
    deliveryMethod: previous.deliveryMethod || null,
    deliveryMethodLabel: getDeliveryMethodLabel(previous.deliveryMethod),
    shipping: previous.shipping,
    shippingFormatted: formatPrice(previous.shipping),
    total: previous.total,
    totalFormatted: formatPrice(previous.total)
  }
}

async function checkOrderStatus({ orderId }) {
  try {
    // Sanitize input — chỉ lấy phần ID (bỏ ký tự thừa #, ORD, prefix...)
    const cleanId = orderId.replace(/^[#ORDord\s-]*/g, '').trim()

    // Thử tìm bằng _id (MongoDB ObjectId)
    let order = null
    if (/^[0-9a-fA-F]{24}$/.test(cleanId)) {
      order = await orderRepository.findOne({ _id: cleanId, isDeleted: false }, { lean: true })
    }

    // Nếu không tìm được, thử tìm đuôi ID (khách thường chỉ nhớ 4-6 ký tự cuối)
    if (!order && cleanId.length >= 4) {
      order = await orderRepository.findOne({
        isDeleted: false
      }, {
        sort: { createdAt: -1 },
        lean: true
      })

      // Kiểm tra đuôi ID
      if (order && !order._id.toString().endsWith(cleanId.toLowerCase())) {
        order = null
      }
    }

    if (!order) {
      return JSON.stringify({
        found: false,
        message: `Không tìm thấy đơn hàng với mã "${orderId}". Bạn vui lòng kiểm tra lại mã đơn hàng nhé.`,
        suggestion: 'Bạn có thể xem đơn hàng trong mục "Đơn hàng của tôi" khi đã đăng nhập.'
      })
    }

    const statusMap = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao hàng',
      completed: 'Đã hoàn thành',
      cancelled: 'Đã huỷ'
    }

    const paymentStatusMap = {
      pending: 'Chưa thanh toán',
      paid: 'Đã thanh toán',
      failed: 'Thanh toán thất bại'
    }

    const itemsSummary = (order.orderItems || []).map(item => ({
      name: item.name,
      qty: item.quantity,
      price: formatPrice(item.price)
    }))

    return JSON.stringify({
      found: true,
      order: {
        id: order._id.toString(),
        status: statusMap[order.status] || order.status,
        rawStatus: order.status,
        paymentStatus: paymentStatusMap[order.paymentStatus] || order.paymentStatus,
        paymentMethod: order.paymentMethod,
        total: formatPrice(order.total),
        items: itemsSummary,
        itemCount: itemsSummary.length,
        createdAt: new Date(order.createdAt).toLocaleDateString('vi-VN'),
        canCancel: order.status === 'pending'
      }
    })
  } catch (err) {
    logger.error('[AI Tool] checkOrderStatus error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi tra cứu đơn hàng.' })
  }
}

/**
 * Lấy danh sách sản phẩm đang giảm giá / Flash Sale
 */

async function listMyOrders({ status, limit = 5 } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem lich su don hang.'
      })
    }

    const normalizedStatus = cleanString(status)
    const normalizedLimit = Math.min(Math.max(Number(limit) || 5, 1), 10)
    const result = await ordersService.getMyOrders(userId)
    const allOrders = Array.isArray(result?.orders) ? result.orders : []
    const filteredOrders = normalizedStatus
      ? allOrders.filter(order => order.status === normalizedStatus)
      : allOrders
    const orders = filteredOrders.slice(0, normalizedLimit)

    return JSON.stringify({
      found: orders.length > 0,
      count: orders.length,
      totalCount: filteredOrders.length,
      message: orders.length > 0 ? null : 'Khong tim thay don hang phu hop voi yeu cau.',
      orders: orders.map(order => buildOrderSummaryPayload(order))
    })
  } catch (err) {
    logger.error('[AI Tool] listMyOrders error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay danh sach don hang.' })
  }
}

async function getOrderDetail({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem chi tiet don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify(resolved.error)

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return JSON.stringify({
      found: true,
      order: buildOrderDetailPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] getOrderDetail error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong tim thay don hang.',
      error: 'Loi khi lay chi tiet don hang.'
    })
  }
}

async function getOrderInvoice({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de lay link hoa don hoac bien nhan cua don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify({ found: false, ...resolved.error })

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return JSON.stringify(buildOrderInvoicePayload(result.order))
  } catch (err) {
    logger.error('[AI Tool] getOrderInvoice error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the lay thong tin hoa don hoac bien nhan cua don hang.',
      error: 'Loi khi lay hoa don/bien nhan don hang.'
    })
  }
}

async function resendOrderConfirmation({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de gui lai email xac nhan don hang.'
      })
    }

    const { order, error } = await resolveOwnedOrderForEmailResend({ userId, orderId, orderCode })
    if (error) return JSON.stringify(error)

    const recipient = await resolveOrderResendRecipient(order, userId)
    if (!recipient?.email) {
      return JSON.stringify({
        success: false,
        emailSent: false,
        order: buildEmailResendOrderPayload(order),
        message: 'Don hang nay chua co email lien he hop le de gui lai xac nhan. Vui long cap nhat email hoac lien he nhan vien ho tro.'
      })
    }

    const { subject, html } = orderConfirmedTemplate(order)
    const emailSent = await sendMail({ to: recipient.email, subject, html })

    return JSON.stringify({
      success: emailSent,
      emailSent,
      emailType: 'order_confirmation',
      recipient: {
        maskedEmail: recipient.maskedEmail,
        source: recipient.source
      },
      order: buildEmailResendOrderPayload(order),
      message: emailSent
        ? `Minh da gui lai email xac nhan don hang ${formatOrderCode(order)} den ${recipient.maskedEmail}.`
        : 'Minh chua gui duoc email xac nhan luc nay. Ban vui long thu lai sau hoac yeu cau gap nhan vien ho tro.'
    })
  } catch (err) {
    logger.error('[AI Tool] resendOrderConfirmation error:', err.message)
    return JSON.stringify({
      success: false,
      emailSent: false,
      message: 'Minh chua gui duoc email xac nhan luc nay. Ban vui long thu lai sau hoac yeu cau gap nhan vien ho tro.',
      error: 'ORDER_CONFIRMATION_RESEND_FAILED'
    })
  }
}

async function resendDigitalDelivery({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de gui lai thong tin ban giao so.'
      })
    }

    const { order, error } = await resolveOwnedOrderForEmailResend({ userId, orderId, orderCode })
    if (error) return JSON.stringify(error)

    const deliverySummary = getDigitalDeliverySummary(order)
    if (order.paymentStatus !== 'paid') {
      return JSON.stringify({
        success: false,
        emailSent: false,
        requiresPaidOrder: true,
        order: buildEmailResendOrderPayload(order),
        digitalDelivery: deliverySummary,
        message: `Don ${formatOrderCode(order)} chua duoc ghi nhan thanh toan nen khong the gui thong tin ban giao so.`
      })
    }

    if (!deliverySummary.hasDigitalDelivery) {
      return JSON.stringify({
        success: false,
        emailSent: false,
        noDigitalDelivery: true,
        order: buildEmailResendOrderPayload(order),
        digitalDelivery: deliverySummary,
        message: `Don ${formatOrderCode(order)} chua co thong tin ban giao so san sang de gui lai.`
      })
    }

    const recipient = await resolveOrderResendRecipient(order, userId)
    if (!recipient?.email) {
      return JSON.stringify({
        success: false,
        emailSent: false,
        order: buildEmailResendOrderPayload(order),
        digitalDelivery: deliverySummary,
        message: 'Don hang nay chua co email lien he hop le de gui thong tin ban giao so. Vui long cap nhat email hoac lien he nhan vien ho tro.'
      })
    }

    const { subject, html } = digitalDeliveryTemplate(order)
    const emailSent = await sendMail({ to: recipient.email, subject, html })

    return JSON.stringify({
      success: emailSent,
      emailSent,
      emailType: 'digital_delivery',
      recipient: {
        maskedEmail: recipient.maskedEmail,
        source: recipient.source
      },
      order: buildEmailResendOrderPayload(order),
      digitalDelivery: deliverySummary,
      credentialsReturnedInChat: false,
      message: emailSent
        ? `Minh da gui lai thong tin ban giao so cua don ${formatOrderCode(order)} den ${recipient.maskedEmail}. Vi bao mat, minh khong hien thi tai khoan, mat khau hay license trong chat.`
        : 'Minh chua gui duoc thong tin ban giao so luc nay. Ban vui long thu lai sau hoac yeu cau gap nhan vien ho tro.'
    })
  } catch (err) {
    logger.error('[AI Tool] resendDigitalDelivery error:', err.message)
    return JSON.stringify({
      success: false,
      emailSent: false,
      credentialsReturnedInChat: false,
      message: 'Minh chua gui duoc thong tin ban giao so luc nay. Ban vui long thu lai sau hoac yeu cau gap nhan vien ho tro.',
      error: 'DIGITAL_DELIVERY_RESEND_FAILED'
    })
  }
}

async function reorderPreviousOrder({
  orderId,
  orderCode,
  paymentMethod,
  deliveryMethod,
  promoCode,
  shipping
} = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de dat lai don hang cu.'
      })
    }

    if (!cleanString(orderId || orderCode)) {
      const result = await ordersService.getMyOrders(userId)
      return JSON.stringify(buildReorderSelectionPayload(Array.isArray(result?.orders) ? result.orders : []))
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const previousOrderResult = await ordersService.getOrderDetail(userId, resolved.orderId)
    const previousOrder = getOrderObject(previousOrderResult.order)
    const reorderItems = buildReorderItemsFromOrder(previousOrder)

    if (reorderItems.length === 0) {
      return JSON.stringify({
        success: false,
        message: `Don ${formatOrderCode(previousOrder)} khong co san pham hop le de dat lai.`,
        sourceOrder: buildOrderPayload(previousOrder)
      })
    }

    const nextDeliveryMethod = normalizeEnum(
      deliveryMethod || previousOrder.deliveryMethod,
      PLACE_ORDER_DELIVERY_METHODS,
      'pickup'
    )
    const nextPaymentMethod = normalizeReorderPaymentMethod(paymentMethod, previousOrder.paymentMethod)
    const nextShipping = Number(shipping)
    const placeOrderArgs = {
      contact: toPlainObject(previousOrder.contact),
      items: reorderItems,
      deliveryMethod: nextDeliveryMethod,
      paymentMethod: nextPaymentMethod,
      promoCode: cleanString(promoCode)
    }

    if (Number.isFinite(nextShipping) && nextShipping >= 0) {
      placeOrderArgs.shipping = nextShipping
    }

    const result = parseToolPayload(await placeOrder(placeOrderArgs, context)) || {}
    const sourceOrder = buildOrderPayload(previousOrder)

    if (!result.success) {
      return JSON.stringify({
        ...result,
        success: false,
        reorder: true,
        sourceOrder,
        message: result.message || `Khong the dat lai don ${sourceOrder.code}.`
      })
    }

    return JSON.stringify({
      ...result,
      reorder: true,
      sourceOrder,
      reorderedItemCount: reorderItems.reduce((sum, item) => sum + item.quantity, 0),
      message: `Da tao don dat lai tu ${sourceOrder.code}. ${result.message || ''}`.trim()
    })
  } catch (err) {
    logger.error('[AI Tool] reorderPreviousOrder error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the dat lai don hang cu.',
      error: 'Loi khi dat lai don hang cu.'
    })
  }
}

async function trackOrderByCode({ orderCode, phone } = {}) {
  try {
    const result = await ordersService.trackOrder({ orderCode, phone })
    const order = result?.order || {}
    const orderId = order.id?.toString?.() || String(order.id || '')

    return JSON.stringify({
      found: true,
      order: {
        ...order,
        id: orderId || null,
        code: order.orderCode || (orderId ? `#${orderId.slice(-8).toUpperCase()}` : null),
        totalFormatted: formatPrice(order.total),
        orderUrl: orderId ? `${CLIENT_URL}/orders/${orderId}` : null
      }
    })
  } catch (err) {
    logger.error('[AI Tool] trackOrderByCode error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong tim thay don hang hoac so dien thoai khong khop.'
    })
  }
}

async function cancelOrder({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de huy don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const result = await ordersService.cancelOrder(userId, resolved.orderId)
    return JSON.stringify({
      success: true,
      message: 'Da huy don hang thanh cong.',
      order: buildOrderPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] cancelOrder error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the huy don hang.',
      error: 'Loi khi huy don hang.'
    })
  }
}

async function updateOrderAddress(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de sua dia chi giao hang cua don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const result = await ordersService.updateOrderAddress(
      userId,
      resolved.orderId,
      buildOrderAddressPatch(args)
    )

    return JSON.stringify({
      success: true,
      message: 'Da cap nhat dia chi giao hang cua don hang.',
      order: buildOrderDetailPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] updateOrderAddress error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the cap nhat dia chi giao hang cua don hang.',
      error: 'Loi khi cap nhat dia chi don hang.'
    })
  }
}

async function updateOrderContact(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de sua thong tin lien he cua don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const result = await ordersService.updateOrderContact(
      userId,
      resolved.orderId,
      buildOrderContactPatch(args)
    )

    return JSON.stringify({
      success: true,
      message: 'Da cap nhat thong tin lien he cua don hang.',
      order: buildOrderDetailPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] updateOrderContact error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the cap nhat thong tin lien he cua don hang.',
      error: 'Loi khi cap nhat thong tin lien he don hang.'
    })
  }
}

async function updatePendingOrderItems(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de sua san pham trong don pending.'
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

    const updatePayload = await buildPendingOrderItemsUpdatePayload(args, order)
    if (updatePayload.error) return JSON.stringify(updatePayload.error)

    const result = await ordersService.updatePendingOrderItems(userId, order._id.toString(), {
      items: updatePayload.items
    })
    const updatedOrder = result.order
    const paymentReference = getOrderPaymentReference(updatedOrder)
    const payment = await createOnlinePaymentRequest(
      updatedOrder.paymentMethod,
      updatedOrder._id.toString(),
      userId,
      paymentReference
    )

    if (updatedOrder.paymentMethod === 'sepay') {
      payment.bankInfo = await getActiveBankInfoPayload({ order: updatedOrder, paymentReference })
    }

    return JSON.stringify({
      success: true,
      requiresPayment: true,
      paymentRefreshed: true,
      message: payment.paymentUrl
        ? 'Da cap nhat san pham/so luong trong don pending. Vui long dung link thanh toan moi de hoan tat don.'
        : 'Da cap nhat san pham/so luong trong don pending. Vui long chuyen khoan dung so tien va noi dung thanh toan moi.',
      order: buildOrderDetailPayload(updatedOrder),
      previous: {
        ...result.previous,
        subtotalFormatted: formatPrice(result.previous?.subtotal),
        discountFormatted: formatPrice(result.previous?.discount),
        shippingFormatted: formatPrice(result.previous?.shipping),
        totalFormatted: formatPrice(result.previous?.total)
      },
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] updatePendingOrderItems error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the cap nhat san pham/so luong trong don pending.',
      error: 'Loi khi cap nhat san pham don pending.'
    })
  }
}

async function applyPromoCodeToPendingOrder(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de ap ma giam gia vao don pending.'
      })
    }

    const code = cleanString(args.code || args.promoCode).toUpperCase()
    if (!code) {
      return JSON.stringify({
        success: false,
        message: 'Vui long cung cap ma giam gia can ap vao don pending.'
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

    const result = await ordersService.applyPromoCodeToPendingOrder(userId, order._id.toString(), code)
    const updatedOrder = result.order
    const payment = await buildPendingOrderPaymentRefresh(updatedOrder, userId)

    return JSON.stringify({
      success: true,
      promoApplied: true,
      requiresPayment: true,
      paymentRefreshed: true,
      message: payment.paymentUrl
        ? `Da ap ma giam gia ${updatedOrder.promo}. Vui long dung link thanh toan moi de hoan tat don.`
        : `Da ap ma giam gia ${updatedOrder.promo}. Vui long chuyen khoan dung so tien va noi dung thanh toan moi.`,
      promo: result.promo ? buildPromoPayload(toPlainObject(result.promo), { subtotal: updatedOrder.subtotal }) : null,
      order: buildOrderDetailPayload(updatedOrder),
      previous: formatPendingOrderChangePrevious(result.previous),
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] applyPromoCodeToPendingOrder error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the ap ma giam gia vao don pending.',
      error: 'Loi khi ap ma giam gia don pending.'
    })
  }
}

async function removePromoCodeFromPendingOrder(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de go ma giam gia khoi don pending.'
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

    const requestedCode = cleanString(args.code || args.promoCode).toUpperCase()
    const currentCode = cleanString(order.promo).toUpperCase()

    if (!currentCode) {
      return JSON.stringify({
        success: true,
        promoRemoved: false,
        paymentRefreshed: false,
        message: 'Don pending nay chua ap ma giam gia nao.',
        order: buildOrderDetailPayload(order)
      })
    }

    if (requestedCode && requestedCode !== currentCode) {
      return JSON.stringify({
        success: false,
        promoRemoved: false,
        message: `Don pending dang ap ma ${currentCode}, khong phai ${requestedCode}. Vui long xac nhan lai ma can go.`,
        order: buildOrderDetailPayload(order)
      })
    }

    const result = await ordersService.removePromoCodeFromPendingOrder(userId, order._id.toString())
    const updatedOrder = result.order
    const payment = await buildPendingOrderPaymentRefresh(updatedOrder, userId)

    return JSON.stringify({
      success: true,
      promoRemoved: true,
      removedPromoCode: result.removedPromoCode || currentCode,
      requiresPayment: true,
      paymentRefreshed: true,
      message: payment.paymentUrl
        ? `Da go ma giam gia ${result.removedPromoCode || currentCode}. Vui long dung link thanh toan moi de hoan tat don.`
        : `Da go ma giam gia ${result.removedPromoCode || currentCode}. Vui long chuyen khoan dung so tien va noi dung thanh toan moi.`,
      order: buildOrderDetailPayload(updatedOrder),
      previous: formatPendingOrderChangePrevious(result.previous),
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] removePromoCodeFromPendingOrder error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the go ma giam gia khoi don pending.',
      error: 'Loi khi go ma giam gia don pending.'
    })
  }
}

async function updatePendingOrderDeliveryMethod(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de doi phuong thuc nhan/giao cua don pending.'
      })
    }

    const deliveryMethod = normalizePendingOrderDeliveryMethod(args.deliveryMethod || args.method)
    if (!deliveryMethod) {
      return JSON.stringify({
        success: false,
        message: 'Phuong thuc nhan/giao khong hop le. Chi ho tro pickup hoac contact.'
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

    const result = await ordersService.updatePendingOrderDeliveryMethod(userId, order._id.toString(), {
      deliveryMethod,
      shipping: args.shipping
    })
    const updatedOrder = result.order
    const payment = await buildPendingOrderPaymentRefresh(updatedOrder, userId)

    return JSON.stringify({
      success: true,
      deliveryMethodChanged: result.previous?.deliveryMethod !== updatedOrder.deliveryMethod,
      requiresPayment: true,
      paymentRefreshed: true,
      deliveryMethod: updatedOrder.deliveryMethod,
      deliveryMethodLabel: getDeliveryMethodLabel(updatedOrder.deliveryMethod),
      shippingRecalculated: true,
      shipping: updatedOrder.shipping,
      shippingFormatted: formatPrice(updatedOrder.shipping),
      message: payment.paymentUrl
        ? 'Da doi phuong thuc nhan/giao va tinh lai phi cho don pending. Vui long dung link thanh toan moi de hoan tat don.'
        : 'Da doi phuong thuc nhan/giao va tinh lai phi cho don pending. Vui long chuyen khoan dung so tien va noi dung thanh toan moi.',
      order: buildOrderDetailPayload(updatedOrder),
      previous: formatPendingOrderDeliveryPrevious(result.previous),
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] updatePendingOrderDeliveryMethod error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the doi phuong thuc nhan/giao cua don pending.',
      error: 'Loi khi doi phuong thuc nhan/giao don pending.'
    })
  }
}

async function getCheckoutProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem thong tin dat hang mac dinh.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'fullName email phone checkoutProfile',
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
      message: 'Da lay thong tin dat hang mac dinh.',
      ...buildCheckoutProfileResponse(user)
    })
  } catch (err) {
    logger.error('[AI Tool] getCheckoutProfile error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay thong tin dat hang mac dinh.' })
  }
}

async function getDeliveryOptions({
  productId,
  productQuery,
  quantity,
  items,
  subtotal,
  promoCode,
  useCart = true
} = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    const requestedItems = normalizePlaceOrderItems({ items, productId, productQuery, quantity })
    const explicitSubtotal = normalizeDeliverySubtotal(subtotal)

    let source = 'generic'
    let cart = null
    let deliveryItems = []
    let missingItems = []
    let inferredSubtotal = explicitSubtotal

    if (requestedItems.length > 0) {
      source = 'product_input'
      const result = await buildDeliveryItemsFromProductInputs(requestedItems)
      deliveryItems = result.items
      missingItems = result.missingItems
      if (inferredSubtotal == null && deliveryItems.length > 0) {
        inferredSubtotal = calculateDeliveryItemsSubtotal(deliveryItems)
      }
    } else if (useCart !== false && isMongoObjectId(userId)) {
      cart = await buildCartSnapshot(userId, { promoCode })
      source = cart.distinctItemCount > 0 ? 'current_cart' : 'generic'

      if (cart.distinctItemCount > 0) {
        deliveryItems = await buildDeliveryItemsFromCart(cart)
        if (inferredSubtotal == null) inferredSubtotal = cart.subtotal
      }
    }

    const eta = buildDeliveryEtaSummary(deliveryItems)
    const availability = buildDeliveryAvailability(deliveryItems)
    const shippingEstimate = buildDeliveryShippingEstimate(inferredSubtotal)

    return JSON.stringify({
      found: true,
      message: buildDeliveryOptionsMessage({ source, deliveryItems, missingItems, availability }),
      source,
      deliveryMethods: buildDeliveryMethodOptions({ eta, availability }),
      eta,
      shippingEstimate,
      context: {
        hasProductContext: deliveryItems.length > 0,
        products: deliveryItems,
        missingItems,
        unavailableItems: availability.unavailableItems,
        cart: cart
          ? {
              cartId: cart.cartId,
              itemCount: cart.itemCount,
              distinctItemCount: cart.distinctItemCount,
              subtotal: cart.subtotal,
              subtotalFormatted: cart.subtotalFormatted,
              hasIssues: cart.hasIssues,
              issues: cart.issues,
              promoValidation: cart.promoValidation
            }
          : null
      }
    })
  } catch (err) {
    logger.error('[AI Tool] getDeliveryOptions error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay phuong thuc nhan hang/giao hang.' })
  }
}

async function updateCheckoutProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi luu thong tin dat hang mac dinh.'
      })
    }

    const payload = normalizeCheckoutProfileToolArgs(args)
    if (!hasCheckoutProfileMutationInput(payload)) {
      return JSON.stringify({
        success: false,
        message: 'Chua co thong tin dat hang mac dinh nao de cap nhat.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'fullName email phone checkoutProfile',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    const checkoutProfile = buildCheckoutProfileUpdate(payload, user.checkoutProfile || {})
    const invalidFields = getInvalidCheckoutProfileFields(checkoutProfile)
    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidFields,
        message: 'Thong tin dat hang mac dinh chua hop le, vui long kiem tra lai so dien thoai hoac email.'
      })
    }

    const updatedUser = await userRepository.updateById(userId, { checkoutProfile }, { new: true })
    if (!updatedUser) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      success: true,
      message: 'Da luu thong tin dat hang mac dinh.',
      ...buildCheckoutProfileResponse(updatedUser)
    })
  } catch (err) {
    logger.error('[AI Tool] updateCheckoutProfile error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat thong tin dat hang mac dinh.' })
  }
}

async function placeOrder({
  contact = {},
  productId,
  productQuery,
  quantity,
  items,
  deliveryMethod,
  paymentMethod,
  promoCode,
  shipping
} = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi dat hang.'
      })
    }

    const explicitPaymentMethod = cleanString(paymentMethod).toLowerCase()
    if (['transfer', 'contact'].includes(explicitPaymentMethod)) {
      return JSON.stringify({
        success: false,
        unsupportedPaymentMethod: explicitPaymentMethod,
        supportedPaymentMethods: PLACE_ORDER_PAYMENT_METHODS,
        message: 'Hien tam tat thanh toan chuyen khoan/thoa thuan. Vui long chon thanh toan online qua VNPay, MoMo, ZaloPay hoac Sepay.'
      })
    }

    const requestedItems = normalizePlaceOrderItems({ items, productId, productQuery, quantity })
    const isDirectOrder = requestedItems.length > 0
    const orderItemResult = isDirectOrder
      ? await buildDirectOrderItems(requestedItems)
      : await buildCartOrderItems(userId, { promoCode })
    if (orderItemResult.error) {
      return JSON.stringify(orderItemResult.error)
    }

    const cart = orderItemResult.cart || null
    const normalizedOrderItems = orderItemResult.orderItems

    const user = await userRepository.findById(userId, {
      select: 'fullName email phone checkoutProfile',
      lean: true
    })
    const orderContact = buildOrderContact({ contact, user })
    const missingFields = getMissingOrderContactFields(orderContact)

    if (missingFields.length > 0) {
      return JSON.stringify({
        success: false,
        missingContactFields: missingFields,
        message: 'Can bo sung ho, ten va so dien thoai truoc khi dat hang.',
        contact: orderContact,
        cart
      })
    }

    const invalidFields = getInvalidOrderContactFields(orderContact)
    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidContactFields: invalidFields,
        message: 'Thong tin lien he chua hop le, vui long kiem tra lai so dien thoai hoac email.',
        contact: orderContact,
        cart
      })
    }

    const selectedPaymentMethod = normalizeOnlinePaymentMethod(explicitPaymentMethod || user?.checkoutProfile?.paymentMethod)
    const selectedDeliveryMethod = normalizeEnum(
      deliveryMethod || user?.checkoutProfile?.deliveryMethod,
      PLACE_ORDER_DELIVERY_METHODS,
      'pickup'
    )
    const subtotal = calculateOrderItemsSubtotal(normalizedOrderItems)
    const normalizedShipping = normalizeShipping(shipping, subtotal)
    const effectivePromoCode = isDirectOrder
      ? cleanString(promoCode)
      : (cleanString(promoCode) || cleanString(cart?.appliedPromo?.code) || cleanString(cart?.promoCode))

    const orderResult = await ordersService.createPendingOrder(userId, {
      contact: orderContact,
      orderItems: normalizedOrderItems,
      deliveryMethod: selectedDeliveryMethod,
      paymentMethod: selectedPaymentMethod,
      shipping: normalizedShipping,
      promo: effectivePromoCode,
      subtotal,
      total: subtotal + normalizedShipping
    })

    const orderId = orderResult.orderId?.toString()
    const payment = await createOnlinePaymentRequest(selectedPaymentMethod, orderId, userId, orderResult.paymentReference)
    const order = await orderRepository.findById(orderId)

    const paymentMessage = payment.paymentUrl
      ? `Da tao don hang ${formatOrderCode(order)} cho thanh toan online. Vui long mo link thanh toan de hoan tat don.`
      : `Da tao don hang ${formatOrderCode(order)} cho Sepay. Vui long chuyen khoan dung so tien va noi dung ${payment.paymentReference} de he thong tu xac nhan.`

    return JSON.stringify({
      success: true,
      requiresPayment: true,
      message: paymentMessage,
      order: buildOrderPayload(order),
      payment,
      cart: isDirectOrder ? null : cart
    })
  } catch (err) {
    logger.error('[AI Tool] placeOrder error:', err.stack || err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Loi khi tao don hang.',
      error: 'Loi khi tao don hang.'
    })
  }
}

module.exports = {
  checkOrderStatus,
  listMyOrders,
  getOrderDetail,
  getOrderInvoice,
  resendOrderConfirmation,
  resendDigitalDelivery,
  reorderPreviousOrder,
  trackOrderByCode,
  cancelOrder,
  updateOrderAddress,
  updateOrderContact,
  updatePendingOrderItems,
  applyPromoCodeToPendingOrder,
  removePromoCodeFromPendingOrder,
  updatePendingOrderDeliveryMethod,
  getCheckoutProfile,
  getDeliveryOptions,
  updateCheckoutProfile,
  placeOrder
}
