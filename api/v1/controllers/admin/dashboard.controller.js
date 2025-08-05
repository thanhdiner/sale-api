const AdminAccount = require('../../models/adminAccount.model')
const User = require('../../models/user.model')
const Order = require('../../models/order.model')
const Product = require('../../models/products.model')
const ProductCategory = require('../../models/product-category.model')

const calcChange = (current, previous) => {
  if (previous === 0) {
    if (current === 0) return { change: 0, trend: 'up' }
    return { change: 100, trend: 'up' }
  }
  const diff = current - previous
  const percent = (diff / previous) * 100
  return {
    change: Math.abs(Number(percent.toFixed(1))),
    trend: percent >= 0 ? 'up' : 'down'
  }
}

function getLastNDays(n) {
  const days = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  return days
}

const getDateRanges = () => {
  const now = new Date()
  const thisWeekStart = new Date()
  const lastWeekStart = new Date()

  thisWeekStart.setDate(now.getDate() - 7)
  lastWeekStart.setDate(now.getDate() - 14)

  return {
    thisWeek: { from: thisWeekStart, to: now },
    lastWeek: { from: lastWeekStart, to: thisWeekStart }
  }
}

const ORDER_STATUSES = ['', 'pending', 'confirmed', 'shipping', 'completed', 'cancelled']

//# [GET] /api/v1/admin/dashboard
module.exports.dashboard = async (req, res) => {
  const statistic = {
    adminAccount: {
      total: 0,
      active: 0,
      inactive: 0,
      new: {}
    },
    user: {
      total: 0,
      active: 0,
      inactive: 0,
      new: {}
    },
    order: {},
    totalRevenue: { value: 0, change: 0, trend: 'up' },
    profit: { value: 0, change: 0, trend: 'up' }
  }

  try {
    const { thisWeek, lastWeek } = getDateRanges()

    const [
      adminTotal,
      adminActive,
      adminInactive,
      adminThisWeek,
      adminLastWeek,

      userTotal,
      userActive,
      userInactive,
      userThisWeek,
      userLastWeek,

      productTotal,
      productActive,
      productInactive,
      productThisWeek,
      productLastWeek,

      categoryTotal,
      categoryActive,
      categoryInactive,
      categoryThisWeek,
      categoryLastWeek
    ] = await Promise.all([
      AdminAccount.countDocuments({ deleted: false }),
      AdminAccount.countDocuments({ status: 'active', deleted: false }),
      AdminAccount.countDocuments({ status: 'inactive', deleted: false }),
      AdminAccount.countDocuments({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
      AdminAccount.countDocuments({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } }),

      User.countDocuments({ deleted: false }),
      User.countDocuments({ status: 'active', deleted: false }),
      User.countDocuments({ status: 'inactive', deleted: false }),
      User.countDocuments({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
      User.countDocuments({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } }),

      Product.countDocuments({ deleted: false }),
      Product.countDocuments({ status: 'active', deleted: false }),
      Product.countDocuments({ status: 'inactive', deleted: false }),
      Product.countDocuments({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
      Product.countDocuments({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } }),

      ProductCategory.countDocuments({ deleted: false }),
      ProductCategory.countDocuments({ status: 'active', deleted: false }),
      ProductCategory.countDocuments({ status: 'inactive', deleted: false }),
      ProductCategory.countDocuments({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
      ProductCategory.countDocuments({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } })
    ])

    statistic.adminAccount.total = adminTotal
    statistic.adminAccount.active = adminActive
    statistic.adminAccount.inactive = adminInactive
    statistic.adminAccount.new = {
      current: adminThisWeek,
      previous: adminLastWeek,
      ...calcChange(adminThisWeek, adminLastWeek)
    }

    statistic.user.total = userTotal
    statistic.user.active = userActive
    statistic.user.inactive = userInactive
    statistic.user.new = {
      current: userThisWeek,
      previous: userLastWeek,
      ...calcChange(userThisWeek, userLastWeek)
    }

    statistic.product = {
      total: productTotal,
      active: productActive,
      inactive: productInactive,
      new: {
        current: productThisWeek,
        previous: productLastWeek,
        ...calcChange(productThisWeek, productLastWeek)
      }
    }

    statistic.category = {
      total: categoryTotal,
      active: categoryActive,
      inactive: categoryInactive,
      new: {
        current: categoryThisWeek,
        previous: categoryLastWeek,
        ...calcChange(categoryThisWeek, categoryLastWeek)
      }
    }

    const orderStatusStats = {}
    await Promise.all(
      ORDER_STATUSES.map(async status => {
        let baseFilter = { isDeleted: false }
        if (status) baseFilter.status = status

        const total = await Order.countDocuments(baseFilter)

        const newWeek = await Order.countDocuments({
          ...baseFilter,
          createdAt: { $gte: thisWeek.from, $lt: thisWeek.to }
        })

        const lastWeekCount = await Order.countDocuments({
          ...baseFilter,
          createdAt: { $gte: lastWeek.from, $lt: thisWeek.from }
        })

        orderStatusStats[status || 'all'] = {
          total,
          new: {
            current: newWeek,
            previous: lastWeekCount,
            ...calcChange(newWeek, lastWeekCount)
          }
        }
      })
    )
    statistic.order = orderStatusStats

    const revenueThisWeek = await Order.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ])
    const revenueLastWeek = await Order.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ])
    const revenueCurrent = revenueThisWeek[0]?.total || 0
    const revenuePrevious = revenueLastWeek[0]?.total || 0
    const { change: revenueChange, trend: revenueTrend } = calcChange(revenueCurrent, revenuePrevious)
    statistic.totalRevenue = {
      value: revenueCurrent,
      change: revenueChange,
      trend: revenueTrend
    }

    const profitThisWeek = await Order.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: null,
          profit: {
            $sum: {
              $multiply: [{ $subtract: ['$orderItems.price', '$orderItems.costPrice'] }, '$orderItems.quantity']
            }
          }
        }
      }
    ])
    const profitLastWeek = await Order.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: null,
          profit: {
            $sum: {
              $multiply: [{ $subtract: ['$orderItems.price', '$orderItems.costPrice'] }, '$orderItems.quantity']
            }
          }
        }
      }
    ])
    const profitCurrent = profitThisWeek[0]?.profit || 0
    const profitPrevious = profitLastWeek[0]?.profit || 0
    const { change: profitChange, trend: profitTrend } = calcChange(profitCurrent, profitPrevious)
    statistic.profit = {
      value: profitCurrent,
      change: profitChange,
      trend: profitTrend
    }

    const range = req.query.range || '7days'
    let numDays = 7
    if (range === '30days') numDays = 30
    else if (range === '90days') numDays = 90

    const lastNDays = getLastNDays(numDays)
    const salesAgg = await Order.aggregate([
      {
        $match: {
          isDeleted: false,
          status: 'completed',
          createdAt: { $gte: lastNDays[0], $lt: new Date() }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ])
    const salesNDays = lastNDays.map(date => {
      const key = date.toISOString().slice(0, 10)
      const found = salesAgg.find(item => item._id === key)
      return {
        date: key,
        value: found ? found.total : 0
      }
    })
    statistic.salesNDays = salesNDays

    const categoryStats = await Product.aggregate([
      { $match: { deleted: false } },
      {
        $group: {
          _id: '$productCategory',
          total: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'product_categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $project: {
          name: '$categoryInfo.title',
          total: 1
        }
      },
      { $sort: { total: -1 } }
    ])
    statistic.categoryStats = categoryStats

    const topCustomers = await Order.aggregate([
      { $match: { isDeleted: false, status: 'completed' } },
      {
        $group: {
          _id: '$userId',
          totalSpent: { $sum: '$total' },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          _id: 1,
          totalSpent: 1,
          totalOrders: 1,
          fullName: '$userInfo.fullName',
          avatarUrl: '$userInfo.avatarUrl',
          email: '$userInfo.email'
        }
      }
    ])
    statistic.topCustomers = topCustomers

    const recentOrders = await Order.aggregate([
      { $match: { isDeleted: false } },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          _id: 1,
          orderId: '$_id',
          customer: '$userInfo.fullName',
          avatar: '$userInfo.avatarUrl',
          amount: '$total',
          status: 1,
          time: '$createdAt'
        }
      }
    ])
    statistic.recentOrders = recentOrders

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)

    const prevWeekStart = new Date(now)
    prevWeekStart.setDate(now.getDate() - 14)

    const productsThisWeek = await Order.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: weekStart, $lt: now } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.productId',
          name: { $first: '$orderItems.name' },
          image: { $first: '$orderItems.image' },
          sales: { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 9 }
    ])

    const productsPrevWeek = await Order.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: prevWeekStart, $lt: weekStart } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.productId',
          sales: { $sum: '$orderItems.quantity' }
        }
      }
    ])

    const prevWeekMap = new Map()
    productsPrevWeek.forEach(p => prevWeekMap.set(String(p._id), p.sales))

    const topProducts = productsThisWeek.map(p => {
      const prevSales = prevWeekMap.get(String(p._id)) || 0
      let trend = 'up'
      if (prevSales > p.sales) trend = 'down'
      if (prevSales === p.sales) trend = 'equal'
      return { ...p, trend }
    })

    statistic.topProducts = topProducts

    return res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: statistic
    })
  } catch (err) {
    console.error('Error fetching dashboard data:', err)
    return res.status(500).json({
      error: 'Failed to fetch dashboard data',
      status: 500
    })
  }
}
