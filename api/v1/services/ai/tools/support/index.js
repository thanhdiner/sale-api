const contactExecutors = require('./contact.executors')
const ticketExecutors = require('./tickets.executors')
const returnExecutors = require('./returns.executors')
const warrantyExecutors = require('./warranty.executors')
const storeInfoExecutors = require('./storeInfo.executors')
const handoffExecutors = require('./handoff.executors')

module.exports = {
  ...contactExecutors,
  ...ticketExecutors,
  ...returnExecutors,
  ...warrantyExecutors,
  ...storeInfoExecutors,
  ...handoffExecutors
}
