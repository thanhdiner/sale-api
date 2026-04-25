const ReviewVote = require('../models/reviewVote.model')

async function find(query = {}) {
  return ReviewVote.find(query)
}

async function findOne(query = {}) {
  return ReviewVote.findOne(query)
}

async function create(payload) {
  return ReviewVote.create(payload)
}

async function deleteOne(filter = {}) {
  return ReviewVote.deleteOne(filter)
}

async function deleteMany(filter = {}) {
  return ReviewVote.deleteMany(filter)
}

module.exports = {
  find,
  findOne,
  create,
  deleteOne,
  deleteMany
}
