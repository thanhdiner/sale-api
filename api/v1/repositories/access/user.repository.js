const User = require('../../models/access/user.model')

async function findOne(query = {}) {
  return User.findOne(query)
}

async function findById(userId, options = {}) {
  const { select, lean = false } = options
  let cursor = User.findById(userId)

  if (select) {
    cursor = cursor.select(select)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findEmailById(userId) {
  return User.findById(userId).select('email').lean()
}

async function countByQuery(query = {}) {
  return User.countDocuments(query)
}

async function create(payload) {
  return User.create(payload)
}

async function updateById(userId, payload, options = {}) {
  return User.findByIdAndUpdate(userId, payload, {
    new: true,
    ...options
  })
}

module.exports = {
  findOne,
  findById,
  findEmailById,
  countByQuery,
  create,
  updateById
}










