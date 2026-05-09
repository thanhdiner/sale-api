const QuickReplyCategory = require('../../models/chatbot/quickReplyCategory.model')

async function findById(id) {
  return QuickReplyCategory.findById(id)
}

async function findByIdNotDeleted(id) {
  return QuickReplyCategory.findOne({ _id: id, isDeleted: false })
}

async function findOne(query) {
  return QuickReplyCategory.findOne(query)
}

async function countByQuery(query) {
  return QuickReplyCategory.countDocuments(query)
}

async function findByQuery(query, options = {}) {
  const {
    sort = { sortOrder: 1, name: 1 },
    skip = 0,
    limit,
    lean = false
  } = options

  let cursor = QuickReplyCategory.find(query).sort(sort).skip(skip)

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return QuickReplyCategory.create(payload)
}

async function insertMany(payloads) {
  return QuickReplyCategory.insertMany(payloads, { ordered: false })
}

async function deleteById(id) {
  return QuickReplyCategory.findByIdAndDelete(id)
}

module.exports = {
  countByQuery,
  create,
  deleteById,
  findById,
  findByIdNotDeleted,
  findByQuery,
  findOne,
  insertMany
}










