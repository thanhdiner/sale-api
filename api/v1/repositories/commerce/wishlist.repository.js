const Wishlist = require('../../models/commerce/wishlist.model')

async function findByUserId(userId) {
  return Wishlist.findOne({ userId })
}

async function createForUser(userId) {
  return Wishlist.create({ userId, items: [] })
}

async function save(wishlist) {
  return wishlist.save()
}

module.exports = {
  findByUserId,
  createForUser,
  save
}










