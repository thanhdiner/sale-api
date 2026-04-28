/**
 * Compatibility facade for AI tool helpers.
 * Concrete helper implementations live under ./shared/*.
 */

module.exports = {
  ...require('./shared/dependencies'),
  ...require('./shared/constants'),
  ...require('./shared/cart.helpers'),
  ...require('./shared/policy.helpers'),
  ...require('./shared/promo.helpers'),
  ...require('./shared/text.helpers'),
  ...require('./shared/payment.helpers'),
  ...require('./shared/product.helpers'),
  ...require('./shared/format.helpers'),
  ...require('./shared/order.helpers')
}
