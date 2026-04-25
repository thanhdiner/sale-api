const logger = require('../../../../config/logger')
const dashboardService = require('../../services/admin/dashboard.service')

function createDashboardHandler(label, fetcher) {
  return async (req, res) => {
    try {
      const result = await fetcher(req)
      return res.status(200).json(result)
    } catch (err) {
      logger.error(`[Admin] Error fetching dashboard ${label}:`, err)
      return res.status(500).json({ error: `Failed to fetch dashboard ${label}`, status: 500 })
    }
  }
}

//# [GET] /api/v1/admin/dashboard
module.exports.dashboard = createDashboardHandler('data', req =>
  dashboardService.getDashboard(req.query.range || '7days')
)

//# [GET] /api/v1/admin/dashboard/summary
module.exports.summary = createDashboardHandler('summary', () =>
  dashboardService.getDashboardSummary()
)

//# [GET] /api/v1/admin/dashboard/charts
module.exports.charts = createDashboardHandler('charts', req =>
  dashboardService.getDashboardCharts(req.query.range || '7days')
)

//# [GET] /api/v1/admin/dashboard/top-customers
module.exports.topCustomers = createDashboardHandler('top customers', req =>
  dashboardService.getDashboardTopCustomers(req.query.limit)
)

//# [GET] /api/v1/admin/dashboard/recent-orders
module.exports.recentOrders = createDashboardHandler('recent orders', req =>
  dashboardService.getDashboardRecentOrders(req.query.limit)
)

//# [GET] /api/v1/admin/dashboard/best-selling-products
module.exports.bestSellingProducts = createDashboardHandler('best selling products', req =>
  dashboardService.getDashboardBestSellingProducts(req.query.limit)
)
