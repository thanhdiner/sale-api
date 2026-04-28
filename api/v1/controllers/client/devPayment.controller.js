const AppError = require('../../utils/AppError')
const sepayWebhookService = require('../../services/sepayWebhook.service')

module.exports.simulateSepayPayment = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Not found', 404)
    }

    const { orderCode } = req.params
    const order = await sepayWebhookService.findOrderByPaymentReference(orderCode)

    if (!order || order.isDeleted) {
      throw new AppError('Order not found', 404)
    }

    const now = Date.now()
    const result = await sepayWebhookService.handleIncomingTransaction({
      headers: {
        authorization: `Apikey ${sepayWebhookService.getSepayWebhookApiKey()}`
      },
      payload: {
        id: `dev_${now}`,
        gateway: 'DEV_BANK',
        transactionDate: new Date(now).toISOString(),
        accountNumber: process.env.SEPAY_BANK_ACCOUNT || 'DEV_ACCOUNT',
        code: order.orderCode || order._id.toString(),
        content: order.orderCode || order._id.toString(),
        transferType: 'in',
        transferAmount: order.total,
        referenceCode: `DEV_REF_${now}`
      }
    })

    res.json({
      success: true,
      message: 'Simulated Sepay payment successfully',
      processed: Boolean(result.processed),
      order: result.order
    })
  } catch (error) {
    next(error)
  }
}
