const productsRouter = require('./products.route')
const productCategoriesRouter = require('./product-category.route')
const userRouter = require('./user.route')

module.exports = app => {
  const version = '/api/v1'
  app.use(version + '/products', productsRouter)
  app.use(version + '/product-categories', productCategoriesRouter)
  app.use(version + '/user', userRouter)
}
