const productsRouter = require('./products.route')

module.exports = app => {
  const version = '/api/v1'
  app.use(version + '/products', productsRouter)
}
