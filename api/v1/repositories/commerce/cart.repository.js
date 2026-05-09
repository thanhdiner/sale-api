const Cart = require('../../models/commerce/cart.model')

async function findByUserId(userId, options = {}) {
  const { lean = false } = options
  let cursor = Cart.findOne({ userId })

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function createForUser(userId) {
  return Cart.create({ userId, items: [] })
}

async function save(cart) {
  return cart.save()
}

async function aggregate(pipeline = []) {
  return Cart.aggregate(pipeline)
}

module.exports = {
  findByUserId,
  createForUser,
  save,
  aggregate
}










