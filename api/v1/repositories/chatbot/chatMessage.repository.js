const ChatMessage = require('../../models/chatbot/chatMessage.model')

async function create(payload) {
  return ChatMessage.create(payload)
}

async function findByQuery(query = {}, options = {}) {
  let cursor = ChatMessage.find(query)

  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }

  if (typeof options.limit !== 'undefined') {
    cursor = cursor.limit(options.limit)
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findById(id, options = {}) {
  let cursor = ChatMessage.findById(id)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function updateMany(filter = {}, update = {}) {
  return ChatMessage.updateMany(filter, update)
}

module.exports = {
  create,
  findById,
  findByQuery,
  updateMany
}










