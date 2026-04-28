const logger = require('../../../../config/logger')
const sepayWebhookService = require('../../services/sepayWebhook.service')

module.exports.sepayWebhook = async (req, res, next) => {
  try {
    const result = await sepayWebhookService.handleIncomingTransaction({
      headers: req.headers,
      payload: req.body
    })

    res.json({
      success: result.success,
      processed: Boolean(result.processed),
      ignored: Boolean(result.ignored),
      reason: result.reason || null,
      orderId: result.order?._id || null,
      transactionId: result.transactionId || null
    })
  } catch (err) {
    logger.error('[Sepay] webhook error:', err)
    next(err)
  }
}
