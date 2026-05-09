const BankInfo = require('../../models/commerce/bankInfo.model')

async function findById(id) {
  return BankInfo.findById(id)
}

async function findByIdNotDeleted(id) {
  return BankInfo.findOne({ _id: id, isDeleted: false })
}

async function countByQuery(query) {
  return BankInfo.countDocuments(query)
}

async function findByQuery(query, options = {}) {
  const {
    sort = { updatedAt: -1 },
    skip = 0,
    limit
  } = options

  let cursor = BankInfo.find(query).sort(sort).skip(skip)

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  return cursor
}

async function findLatestActive() {
  return BankInfo.findOne({ isActive: true, isDeleted: false }).sort({ updatedAt: -1 })
}

async function create(payload) {
  return BankInfo.create(payload)
}

async function deactivateAll(filter = {}) {
  return BankInfo.updateMany(filter, { $set: { isActive: false } })
}

async function deleteById(id) {
  return BankInfo.findByIdAndDelete(id)
}

module.exports = {
  findById,
  findByIdNotDeleted,
  countByQuery,
  findByQuery,
  findLatestActive,
  create,
  deactivateAll,
  deleteById
}










