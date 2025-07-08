const systemConfig = require('../../../../config/system')
const dashboardRoutes = require('./dashboard.route')
const productsRoutes = require('./product.route')
const productCategoryRoutes = require('./product-category.route')
const permissionsRoutes = require('./permission.route')
const permissionGroupsRoutes = require('./permission-groups.route')
const rolesRoutes = require('./roles.route')
const accountsRoutes = require('./adminAccounts.route')

module.exports = app => {
  const PATH_ADMIN = systemConfig.prefixAdmin

  app.use(PATH_ADMIN + '/dashboard', dashboardRoutes)
  app.use(PATH_ADMIN + '/products', productsRoutes)
  app.use(PATH_ADMIN + '/product-categories', productCategoryRoutes)
  app.use(PATH_ADMIN + '/permissions', permissionsRoutes)
  app.use(PATH_ADMIN + '/permission-groups', permissionGroupsRoutes)
  app.use(PATH_ADMIN + '/roles', rolesRoutes)
  app.use(PATH_ADMIN + '/accounts', accountsRoutes)
}
