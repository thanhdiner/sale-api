const WebsiteConfig = require('../../models/system/websiteConfig.model')

async function findOne(query = {}, options = {}) {
  let cursor = WebsiteConfig.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return WebsiteConfig.create(payload)
}

module.exports = {
  findOne,
  create
}










