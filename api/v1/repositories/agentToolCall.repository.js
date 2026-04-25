const AgentToolCall = require('../models/agentToolCall.model')

async function findByQuery(query = {}, options = {}) {
  let cursor = AgentToolCall.find(query)

  if (options.sort) {
    cursor = cursor.sort(options.sort)
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

module.exports = {
  findByQuery,
  countByQuery,
  create
}
