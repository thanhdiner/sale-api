const productsRouter = require('./product/products.route')
const productCategoriesRouter = require('./product/productCategories.route')
const userRouter = require('./access/user.route')
const cartRouter = require('./commerce/carts.route')
const promoRouter = require('./commerce/promoCodes.route')
const ordersRouter = require('./commerce/orders.route')
const orderTrackingRouter = require('./commerce/orderTracking.route')
const widgetsRouter = require('./system/widgets.route')
const bannersRouter = require('./system/banners.route')
const aboutContentRouter = require('./cms/aboutContent.route')
const termsContentRouter = require('./cms/termsContent.route')
const cooperationContactContentRouter = require('./cms/cooperationContactContent.route')
const homeWhyChooseUsContentRouter = require('./cms/homeWhyChooseUsContent.route')
const blogRouter = require('./blog/blog.route')
const blogCategoryRouter = require('./blog/blogCategory.route')
const blogTagsRouter = require('./blog/blogTags.route')
const cmsPageRouter = require('./cms/cmsPage.route')
const gameNewsContentRouter = require('./cms/gameNewsContent.route')
const vipContentRouter = require('./cms/vipContent.route')
const flashsalesRouter = require('./commerce/flashSales.route')
const contactRouter = require('./cms/contact.route')
const bankInfoRouter = require('./commerce/bankInfo.route')
const reviewsRouter = require('./commerce/reviews.route')
const paymentRouter = require('./commerce/payment.route')
const webhookRouter = require('./commerce/webhook.route')
const wishlistRouter = require('./commerce/wishlist.route')
const chatRouter = require('./chatbot/chat.route')
const privacyPolicyPageRouter = require('./cms/privacyPolicyPage.route')
const returnPolicyPageRouter = require('./cms/returnPolicyPage.route')
const faqPageRouter = require('./cms/faqPage.route')
const footerContentRouter = require('./cms/footerContent.route')
const gameAccountContentRouter = require('./cms/gameAccountContent.route')
const comingSoonContentRouter = require('./cms/comingSoonContent.route')
const devPaymentRouter = require('./commerce/devPayment.route')

const authenticateToken = require('../../middlewares/client/authenticateToken.middleware')

module.exports = app => {
  const version = '/api/v1'
  app.use(version + '/products', productsRouter)
  app.use(version + '/product-categories', productCategoriesRouter)
  app.use(version + '/user', userRouter)
  app.use(version + '/cart', authenticateToken.authenticateToken, cartRouter)
  app.use(version + '/promo-codes', authenticateToken.authenticateToken, promoRouter)
  app.use(version + '/orders', authenticateToken.authenticateToken, ordersRouter)
  app.use(version + '/order-tracking', orderTrackingRouter)
  app.use(version + '/widgets', widgetsRouter)
  app.use(version + '/banners', bannersRouter)
  app.use(version + '/about', aboutContentRouter)
  app.use(version + '/terms', termsContentRouter)
  app.use(version + '/cooperation-contact', cooperationContactContentRouter)
  app.use(version + '/home-why-choose-us', homeWhyChooseUsContentRouter)
  app.use(version + '/blog', blogRouter)
  app.use(version + '/blog-posts', blogRouter)
  app.use(version + '/blog-categories', blogCategoryRouter)
  app.use(version + '/blog-tags', blogTagsRouter)
  app.use(version + '/cms-pages', cmsPageRouter)
  app.use(version + '/game-news', gameNewsContentRouter)
  app.use(version + '/vip', vipContentRouter)
  app.use(version + '/flash-sales', flashsalesRouter)
  app.use(version + '/contact', contactRouter)
  app.use(version + '/bank-info', bankInfoRouter)
  app.use(version + '/reviews', reviewsRouter)
  app.use(version + '/payment', paymentRouter)
  app.use(version + '/webhooks', webhookRouter)
  app.use(version + '/wishlist', authenticateToken.authenticateToken, wishlistRouter)
  app.use(version + '/chat', chatRouter)
  app.use(version + '/privacy-policy', privacyPolicyPageRouter)
  app.use(version + '/return-policy', returnPolicyPageRouter)
  app.use(version + '/faq', faqPageRouter)
  app.use(version + '/footer', footerContentRouter)
  app.use(version + '/game-account', gameAccountContentRouter)
  app.use(version + '/coming-soon', comingSoonContentRouter)

  if (process.env.NODE_ENV !== 'production') {
    app.use(version + '/dev-payments', devPaymentRouter)
  }
}











