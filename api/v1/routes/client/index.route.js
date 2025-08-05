const productsRouter = require('./products.route')
const productCategoriesRouter = require('./product-category.route')
const userRouter = require('./user.route')
const cartRouter = require('./cart.route')
const promoRouter = require('./promo-codes.route')
const ordersRouter = require('./order.route')
const widgetsRouter = require('./widgets.route')
const bannersRouter = require('./banners.route')
const flashsalesRouter = require('./flashsales.route')
const contactRouter = require('./contact.route')

const authenticateToken = require('../../middlewares/client/authenticateToken.middleware')

module.exports = app => {
  const version = '/api/v1'
  app.use(version + '/products', productsRouter)
  app.use(version + '/product-categories', productCategoriesRouter)
  app.use(version + '/user', userRouter)
  app.use(version + '/cart', authenticateToken.authenticateToken, cartRouter)
  app.use(version + '/promo-codes', authenticateToken.authenticateToken, promoRouter)
  app.use(version + '/orders', authenticateToken.authenticateToken, ordersRouter)
  app.use(version + '/widgets', widgetsRouter)
  app.use(version + '/banners', bannersRouter)
  app.use(version + '/flash-sales', flashsalesRouter)
  app.use(version + '/contact', contactRouter)
}
