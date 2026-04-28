const catalogExecutors = require('./catalog.executors')
const cartExecutors = require('./cart.executors')
const orderExecutors = require('./order.executors')
const accountExecutors = require('./account.executors')
const policyExecutors = require('./policy.executors')
const supportExecutors = require('./support.executors')
const paymentExecutors = require('./payment.executors')

const toolExecutors = {
  ...catalogExecutors,
  ...orderExecutors,
  ...paymentExecutors,
  ...cartExecutors,
  ...accountExecutors,
  ...policyExecutors,
  ...supportExecutors
}

module.exports = {
  toolExecutors
}
