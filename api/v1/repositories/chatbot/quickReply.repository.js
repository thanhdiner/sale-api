const QuickReply = require('../../models/chatbot/quickReply.model')

async function findById(id) {
  return QuickReply.findById(id)
}

async function findByIdNotDeleted(id) {
  return QuickReply.findOne({ _id: id, isDeleted: false })
}

async function findOne(query) {
  return QuickReply.findOne(query)
}

async function countByQuery(query) {
  return QuickReply.countDocuments(query)
}

async function findByQuery(query, options = {}) {
  const {
    sort = { updatedAt: -1 },
    skip = 0,
    limit,
    lean = false
  } = options

  let cursor = QuickReply.find(query).sort(sort).skip(skip)

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return QuickReply.create(payload)
}

async function aggregate(pipeline) {
  return QuickReply.aggregate(pipeline)
}

module.exports = {
  aggregate,
  countByQuery,
  create,
  findById,
  findByIdNotDeleted,
  findByQuery,
  findOne
}










