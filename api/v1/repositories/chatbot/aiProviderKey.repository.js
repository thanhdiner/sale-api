const AIProviderKey = require('../../models/chatbot/aiProviderKey.model')

async function findAll(filter = {}, options = {}) {
  const { sort = { createdAt: -1 }, lean = false } = options
  let cursor = AIProviderKey.find(filter).sort(sort)
  if (lean) cursor = cursor.lean()
  return cursor
}

async function findById(id, options = {}) {
  let cursor = AIProviderKey.findById(id)
  if (options.lean) cursor = cursor.lean()
  return cursor
}

async function create(payload) {
  return AIProviderKey.create(payload)
}

async function updateById(id, payload, options = {}) {
  return AIProviderKey.findByIdAndUpdate(id, payload, { new: true, runValidators: true, ...options })
}

async function countByQuery(filter = {}) {
  return AIProviderKey.countDocuments(filter)
}

async function deleteById(id) {
  return AIProviderKey.findByIdAndDelete(id)
}

module.exports = {
  findAll,
  findById,
  create,
  updateById,
  countByQuery,
  deleteById
}
