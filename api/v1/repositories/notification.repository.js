const Notification = require('../models/notification.model')

async function create(payload) {
  return Notification.create(payload)
}

async function findByQuery(query = {}, options = {}) {
  const {
    select,
    sort = { createdAt: -1 },
    skip = 0,
    limit,
    lean = false
  } = options

  let cursor = Notification.find(query).sort(sort).skip(skip)

  if (select) {
    cursor = cursor.select(select)
  }

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function countByQuery(query = {}) {
  return Notification.countDocuments(query)
}

async function findOneAndUpdate(query = {}, update = {}, options = {}) {
  return Notification.findOneAndUpdate(query, update, {
    new: true,
    ...options
  })
}

async function updateMany(query = {}, update = {}) {
  return Notification.updateMany(query, update)
}

module.exports = {
  create,
  findByQuery,
  countByQuery,
  findOneAndUpdate,
  updateMany
}
