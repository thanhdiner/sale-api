const ChatbotRulesHistory = require('../../models/chatbot/chatbotRulesHistory.model')

async function create(payload) {
  return ChatbotRulesHistory.create(payload)
}

async function findAll(filter = {}, options = {}) {
  const { sort = { createdAt: -1 }, limit = 20, lean = false } = options
  let cursor = ChatbotRulesHistory.find(filter).sort(sort).limit(limit)
  if (lean) cursor = cursor.lean()
  return cursor
}

async function findById(id, options = {}) {
  let cursor = ChatbotRulesHistory.findById(id)
  if (options.lean) cursor = cursor.lean()
  return cursor
}

module.exports = {
  create,
  findAll,
  findById
}
