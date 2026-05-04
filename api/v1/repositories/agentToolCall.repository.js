const AgentToolCall = require('../models/agentToolCall.model')

async function findByQuery(query = {}, options = {}) {
  let cursor = AgentToolCall.find(query)

  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }

  if (typeof options.skip === 'number') {
    cursor = cursor.skip(options.skip)
  }

  if (typeof options.limit === 'number') {
    cursor = cursor.limit(options.limit)
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function countByQuery(query = {}) {
  return AgentToolCall.countDocuments(query)
}

async function create(payload) {
  return AgentToolCall.create(payload)
}

async function updateById(id, update = {}, options = {}) {
  let cursor = AgentToolCall.findByIdAndUpdate(id, update, { new: true })

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

module.exports = {
  findByQuery,
  countByQuery,
  create,
  updateById
}
