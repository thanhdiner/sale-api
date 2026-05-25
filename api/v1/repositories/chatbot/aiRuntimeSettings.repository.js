const AIRuntimeSettings = require('../../models/chatbot/aiRuntimeSettings.model')

async function findOne(options = {}) {
  let cursor = AIRuntimeSettings.findOne({})
  if (options.lean) cursor = cursor.lean()
  return cursor
}

async function create(payload = {}) {
  return AIRuntimeSettings.create(payload)
}

async function updateOne(payload = {}) {
  const current = await AIRuntimeSettings.findOne({})
  if (current) {
    Object.assign(current, payload)
    return current.save()
  }

  return AIRuntimeSettings.create(payload)
}

module.exports = {
  findOne,
  create,
  updateOne
}
