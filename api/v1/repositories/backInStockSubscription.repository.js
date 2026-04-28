const BackInStockSubscription = require('../models/backInStockSubscription.model')

async function findPendingByProductAndEmail(productId, email) {
  return BackInStockSubscription.findOne({
    productId,
    email,
    status: 'pending'
  })
}

async function cancelPendingByProductAndEmail(productId, email) {
  return BackInStockSubscription.findOneAndUpdate(
    {
      productId,
      email,
      status: 'pending'
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date()
      }
    },
    { new: true }
  )
}

async function findPendingByProductId(productId) {
  return BackInStockSubscription.find({
    productId,
    status: 'pending'
  }).sort({ createdAt: 1 })
}

async function create(payload) {
  return BackInStockSubscription.create(payload)
}

async function markNotified(subscriptionIds = []) {
  if (!subscriptionIds.length) {
    return { modifiedCount: 0 }
  }

  return BackInStockSubscription.updateMany(
    { _id: { $in: subscriptionIds }, status: 'pending' },
    {
      $set: {
        status: 'notified',
        notifiedAt: new Date()
      }
    }
  )
}

module.exports = {
  findPendingByProductAndEmail,
  cancelPendingByProductAndEmail,
  findPendingByProductId,
  create,
  markNotified
}
