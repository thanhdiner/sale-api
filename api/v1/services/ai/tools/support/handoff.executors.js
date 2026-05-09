const {
  buildHandoffResponse
} = require('./support.helpers')

async function handoffToHuman(args = {}, context = {}) {
  return buildHandoffResponse(args, context)
}

async function requestHumanAgent(args = {}, context = {}) {
  return buildHandoffResponse(args, context)
}

module.exports = {
  handoffToHuman,
  requestHumanAgent
}










