const catalogTools = require('./catalog.tools')
const cartTools = require('./cart.tools')
const orderTools = require('./order.tools')
const accountTools = require('./account.tools')
const policyTools = require('./policy.tools')
const supportTools = require('./support.tools')
const paymentTools = require('./payment.tools')

const DOMAIN_TOOL_REGISTRIES = [
  ...catalogTools,
  ...orderTools,
  ...paymentTools,
  ...cartTools,
  ...accountTools,
  ...policyTools,
  ...supportTools
]

const TOOL_ORDER = [
    "searchProducts",
    "getProductDetail",
    "checkProductAvailability",
    "getProductAlternatives",
    "subscribeBackInStock",
    "unsubscribeBackInStock",
    "compareProducts",
    "checkOrderStatus",
    "listMyOrders",
    "getOrderDetail",
    "getOrderInvoice",
    "resendOrderConfirmation",
    "resendDigitalDelivery",
    "reorderPreviousOrder",
    "trackOrderByCode",
    "cancelOrder",
    "updateOrderAddress",
    "updateOrderContact",
    "updatePendingOrderItems",
    "applyPromoCodeToPendingOrder",
    "removePromoCodeFromPendingOrder",
    "updatePendingOrderDeliveryMethod",
    "checkPaymentStatus",
    "resumePayment",
    "updatePendingOrderPaymentMethod",
    "getBankInfo",
    "verifyBankTransfer",
    "submitPaymentProof",
    "getFlashSales",
    "getAvailablePromoCodes",
    "getCouponWallet",
    "checkPromoCode",
    "getVipBenefits",
    "getLoyaltyStatus",
    "getCart",
    "addToCart",
    "updateCartQuantity",
    "removeFromCart",
    "applyPromoCodeToCart",
    "validateCart",
    "removePromoCodeFromCart",
    "getCheckoutProfile",
    "getUserProfile",
    "requestPasswordReset",
    "getNotificationPreferences",
    "listNotifications",
    "markNotificationRead",
    "updateUserProfile",
    "requestEmailChange",
    "verifyEmailChange",
    "requestAccountDeletion",
    "getDeliveryOptions",
    "updateCheckoutProfile",
    "updateNotificationPreferences",
    "placeOrder",
    "clearCart",
    "getWishlist",
    "addToWishlist",
    "removeFromWishlist",
    "toggleWishlist",
    "clearWishlist",
    "searchPolicies",
    "getReturnPolicy",
    "getPrivacyPolicy",
    "getTermsOfService",
    "getFAQ",
    "searchBlogPosts",
    "getBuyingGuides",
    "browseByCategory",
    "getPersonalizedRecommendations",
    "getRecentViewedProducts",
    "getRelatedProducts",
    "getPopularProducts",
    "getProductReviewSummary",
    "getProductReviews",
    "createReview",
    "updateReview",
    "deleteReview",
    "voteReview",
    "submitContactRequest",
    "scheduleCallback",
    "createSupportTicket",
    "updateSupportTicket",
    "requestPersonalDataExport",
    "listMySupportTickets",
    "cancelSupportTicket",
    "reportBugOrIssue",
    "getRefundStatus",
    "getWarrantyStatus",
    "requestWarrantySupport",
    "requestReturnOrRefund",
    "getSupportTicketStatus",
    "addSupportTicketMessage",
    "getStoreConfig",
    "getSupportInfo",
    "getStoreLocations",
    "handoffToHuman",
    "requestHumanAgent"
  ]

function assertUniqueToolNames(tools = []) {
  const seen = new Set()
  const duplicates = []

  tools.forEach(tool => {
    if (seen.has(tool.name)) duplicates.push(tool.name)
    seen.add(tool.name)
  })

  if (duplicates.length > 0) {
    throw new Error(`Duplicate AI tool registry entries: ${duplicates.join(', ')}`)
  }
}

assertUniqueToolNames(DOMAIN_TOOL_REGISTRIES)

const toolsByName = new Map(DOMAIN_TOOL_REGISTRIES.map(tool => [tool.name, tool]))
const missingToolNames = TOOL_ORDER.filter(toolName => !toolsByName.has(toolName))

if (missingToolNames.length > 0) {
  throw new Error(`Missing AI tool registry entries: ${missingToolNames.join(', ')}`)
}

const TOOL_REGISTRY = TOOL_ORDER.map(toolName => toolsByName.get(toolName))

function buildToolSettingsMap(toolSettings = []) {
  return new Map(
    (Array.isArray(toolSettings) ? toolSettings : [])
      .filter(item => item && typeof item.name === 'string')
      .map(item => [item.name, item.enabled !== false])
  )
}

function getToolRegistry(toolSettings = []) {
  const toolSettingsMap = buildToolSettingsMap(toolSettings)

  return TOOL_REGISTRY.map(tool => ({
    ...tool,
    enabled: toolSettingsMap.has(tool.name)
      ? toolSettingsMap.get(tool.name)
      : tool.defaultEnabled
  }))
}

function getToolDefinitions(toolSettings = []) {
  return getToolRegistry(toolSettings)
    .filter(tool => tool.enabled)
    .map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
}

function getToolByName(toolName) {
  return TOOL_REGISTRY.find(tool => tool.name === toolName) || null
}


module.exports = {
  TOOL_REGISTRY,
  getToolByName,
  getToolDefinitions,
  getToolRegistry
}













