const AIProviderKeyLog = require('../../models/chatbot/aiProviderKeyLog.model')

async function findAll(filter = {}, options = {}) {
  const { sort = { createdAt: -1 }, limit = 100, lean = false } = options
  let cursor = AIProviderKeyLog.find(filter).sort(sort).limit(limit)
  if (lean) cursor = cursor.lean()
  return cursor
}

async function create(payload) {
  return AIProviderKeyLog.create(payload)
}

module.exports = {
  findAll,
  create
}
