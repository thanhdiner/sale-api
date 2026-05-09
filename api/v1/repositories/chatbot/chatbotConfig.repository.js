const ChatbotConfig = require('../../models/chatbot/chatbotConfig.model')

async function findOne(query = {}, options = {}) {
  let cursor = ChatbotConfig.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return ChatbotConfig.create(payload)
}

module.exports = {
  findOne,
  create
}










