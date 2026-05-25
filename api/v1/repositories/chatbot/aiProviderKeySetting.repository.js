const AIProviderKeySetting = require('../../models/chatbot/aiProviderKeySetting.model')

async function findOne(options = {}) {
  let cursor = AIProviderKeySetting.findOne({})
  if (options.lean) cursor = cursor.lean()
  return cursor
}

async function create(payload = {}) {
  return AIProviderKeySetting.create(payload)
}

async function updateOne(payload = {}) {
  return AIProviderKeySetting.findOneAndUpdate({}, payload, { new: true, upsert: true, runValidators: true })
}

module.exports = {
  findOne,
  create,
  updateOne
}
