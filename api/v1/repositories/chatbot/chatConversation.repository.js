const ChatConversation = require('../../models/chatbot/chatConversation.model')

async function findOne(query = {}, options = {}) {
  let cursor = ChatConversation.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findByQuery(query = {}, options = {}) {
  let cursor = ChatConversation.find(query)

  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }

  if (typeof options.limit !== 'undefined') {
    cursor = cursor.limit(options.limit)
  }

  if (typeof options.skip !== 'undefined') {
    cursor = cursor.skip(options.skip)
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function countByQuery(query = {}) {
  return ChatConversation.countDocuments(query)
}

async function create(payload) {
  return ChatConversation.create(payload)
}

async function findOneAndUpdate(filter = {}, update = {}, options = {}) {
  return ChatConversation.findOneAndUpdate(filter, update, options)
}

async function updateOne(filter = {}, update = {}) {
  return ChatConversation.updateOne(filter, update)
}

module.exports = {
  findOne,
  findByQuery,
  countByQuery,
  create,
  findOneAndUpdate,
  updateOne
}










