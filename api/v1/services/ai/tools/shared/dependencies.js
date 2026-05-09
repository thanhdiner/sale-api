/**
 * Shared dependencies for AI tool executors.
 */

const productRepository = require('../../../../repositories/product/product.repository')

const productCategoryRepository = require('../../../../repositories/product/productCategory.repository')

const productViewRepository = require('../../../../repositories/product/productView.repository')

const orderRepository = require('../../../../repositories/commerce/order.repository')

const cartRepository = require('../../../../repositories/commerce/cart.repository')

const wishlistRepository = require('../../../../repositories/commerce/wishlist.repository')

const promoCodeRepository = require('../../../../repositories/commerce/promoCode.repository')

const reviewRepository = require('../../../../repositories/commerce/review.repository')

const userRepository = require('../../../../repositories/access/user.repository')

const blogPostRepository = require('../../../../repositories/blog/blogPost.repository')

const websiteConfigRepository = require('../../../../repositories/system/websiteConfig.repository')

const agentToolCallRepository = require('../../../../repositories/chatbot/agentToolCall.repository')

const { findAllDescendantIds } = require('../../../../helpers/product-categoryHelper')

const ordersService = require('../../../client/commerce/orders.service')

const paymentService = require('../../../client/commerce/payment.service')

const bankInfoService = require('../../../client/commerce/bankInfo.service')

const notificationsService = require('../../../client/commerce/notifications.service')

const backInStockService = require('../../../shared/commerce/backInStock.service')

const clientUserService = require('../../../client/access/user.service')

const clientProductService = require('../../../client/product/products.service')

const clientReviewsService = require('../../../client/commerce/reviews.service')

const faqPageService = require('../../../shared/cms/faqPage.service')

const returnPolicyPageService = require('../../../shared/cms/returnPolicyPage.service')

const privacyPolicyPageService = require('../../../shared/cms/privacyPolicyPage.service')

const termsContentService = require('../../../client/cms/termsContent.service')

const vipContentService = require('../../../client/cms/vipContent.service')

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










