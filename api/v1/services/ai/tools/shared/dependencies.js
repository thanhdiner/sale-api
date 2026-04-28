/**
 * Shared dependencies for AI tool executors.
 */

const productRepository = require('../../../../repositories/product.repository')

const productCategoryRepository = require('../../../../repositories/productCategory.repository')

const productViewRepository = require('../../../../repositories/productView.repository')

const orderRepository = require('../../../../repositories/order.repository')

const cartRepository = require('../../../../repositories/cart.repository')

const wishlistRepository = require('../../../../repositories/wishlist.repository')

const promoCodeRepository = require('../../../../repositories/promoCode.repository')

const reviewRepository = require('../../../../repositories/review.repository')

const userRepository = require('../../../../repositories/user.repository')

const blogPostRepository = require('../../../../repositories/blogPost.repository')

const websiteConfigRepository = require('../../../../repositories/websiteConfig.repository')

const agentToolCallRepository = require('../../../../repositories/agentToolCall.repository')

const { findAllDescendantIds } = require('../../../../helpers/product-categoryHelper')

const ordersService = require('../../../client/orders.service')

const paymentService = require('../../../client/payment.service')

const bankInfoService = require('../../../client/bankInfo.service')

const notificationsService = require('../../../client/notifications.service')

const backInStockService = require('../../../backInStock.service')

const clientUserService = require('../../../client/user.service')

const clientProductService = require('../../../client/products.service')

const clientReviewsService = require('../../../client/reviews.service')

const faqPageService = require('../../../faqPage.service')

const returnPolicyPageService = require('../../../returnPolicyPage.service')

const privacyPolicyPageService = require('../../../privacyPolicyPage.service')

const termsContentService = require('../../../client/termsContent.service')

const vipContentService = require('../../../client/vipContent.service')

const { normalizeStructuredAddress } = require('../../../../utils/structuredAddress')

const { sendMail } = require('../../../../../../config/mailer')

const { orderConfirmedTemplate, digitalDeliveryTemplate } = require('../../../../utils/emailTemplates')

const applyTranslation = require('../../../../utils/applyTranslation')

const logger = require('../../../../../../config/logger')

const removeAccents = require('remove-accents')

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

module.exports = {
  productRepository,
  productCategoryRepository,
  productViewRepository,
  orderRepository,
  cartRepository,
  wishlistRepository,
  promoCodeRepository,
  reviewRepository,
  userRepository,
  blogPostRepository,
  websiteConfigRepository,
  agentToolCallRepository,
  findAllDescendantIds,
  ordersService,
  paymentService,
  bankInfoService,
  notificationsService,
  backInStockService,
  clientUserService,
  clientProductService,
  clientReviewsService,
  faqPageService,
  returnPolicyPageService,
  privacyPolicyPageService,
  termsContentService,
  vipContentService,
  normalizeStructuredAddress,
  sendMail,
  orderConfirmedTemplate,
  digitalDeliveryTemplate,
  applyTranslation,
  logger,
  removeAccents,
  CLIENT_URL
}
