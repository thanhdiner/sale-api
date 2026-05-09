/**
 * Cart helpers for AI tool executors.
 */

const { cartRepository, productRepository } = require('./dependencies')

const { MAX_CART_UNIQUE_ITEMS } = require('./constants')

const { cleanString, parseToolPayload } = require('./text.helpers')

const { formatPrice } = require('./format.helpers')

const { calculateEffectiveProductPrice, isSellableProduct } = require('./product.helpers')

const { checkPromoCode } = require('./promo.helpers')

async function buildCartSnapshot(userId, { promoCode, ignoreStoredPromo = false } = {}) {
  const cart = await cartRepository.findByUserId(userId, { lean: true })

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return {
      cartId: cart?._id?.toString() || null,
      itemCount: 0,
      distinctItemCount: 0,
      remainingSlots: MAX_CART_UNIQUE_ITEMS,
      subtotal: 0,
      subtotalFormatted: formatPrice(0),
      items: [],
      issues: [],
      hasIssues: false,
      promoCode: null,
      appliedPromo: null,
      discount: 0,
      discountFormatted: formatPrice(0),
      estimatedTotal: 0,
      estimatedTotalFormatted: formatPrice(0),
      promoValidation: null
    }
  }

  const productIds = cart.items.map(item => item.productId)
  const products = await productRepository.findByQuery(
    { _id: { $in: productIds } },
    {
      select: 'title price discountPercentage stock thumbnail slug status deleted',
      lean: true
    }
  )

  const productMap = new Map(products.map(product => [product._id.toString(), product]))
  const items = cart.items.map((item, index) => {
    const product = productMap.get(item.productId.toString()) || null
    const storedUnitPrice = getStoredCartUnitPrice(item)
    const currentUnitPrice = product ? calculateEffectiveProductPrice(product) : storedUnitPrice
    const displayUnitPrice = item.isFlashSale && item.salePrice != null ? Number(item.salePrice) : currentUnitPrice
    const quantity = Number(item.quantity || 0)
    const itemIssues = []

    if (!isSellableProduct(product)) {
      itemIssues.push({
        code: 'unavailable',
        message: 'San pham khong con ban tren he thong.'
      })
    } else {
      if (Number(product.stock || 0) <= 0) {
        itemIssues.push({
          code: 'out_of_stock',
          message: 'San pham hien da het hang.'
        })
      }

      if (quantity > Number(product.stock || 0)) {
        itemIssues.push({
          code: 'quantity_exceeds_stock',
          message: `So luong trong gio (${quantity}) vuot ton kho hien co (${product.stock || 0}).`
        })
      }

      if (!item.isFlashSale && storedUnitPrice !== currentUnitPrice) {
        itemIssues.push({
          code: 'price_changed',
          message: `Gia san pham da thay doi tu ${formatPrice(storedUnitPrice)} thanh ${formatPrice(currentUnitPrice)}.`
        })
      }
    }

    return {
      line: index + 1,
      productId: item.productId.toString(),
      slug: product?.slug || item.slug || null,
      name: product?.title || item.name || 'San pham khong xac dinh',
      quantity,
      stock: product?.stock ?? 0,
      inStock: !!product && Number(product.stock || 0) > 0,
      unitPrice: displayUnitPrice,
      unitPriceFormatted: formatPrice(displayUnitPrice),
      currentUnitPrice,
      currentUnitPriceFormatted: formatPrice(currentUnitPrice),
      storedUnitPrice,
      storedUnitPriceFormatted: formatPrice(storedUnitPrice),
      lineTotal: displayUnitPrice * quantity,
      lineTotalFormatted: formatPrice(displayUnitPrice * quantity),
      image: product?.thumbnail || item.image || null,
      discountPercentage: product?.discountPercentage ?? item.discountPercentage ?? 0,
      isFlashSale: !!item.isFlashSale,
      flashSaleId: item.flashSaleId ? item.flashSaleId.toString() : null,
      salePrice: item.salePrice != null ? Number(item.salePrice) : null,
      issues: itemIssues
    }
  })

  const issues = items.flatMap(item =>
    item.issues.map(issue => ({
      ...issue,
      productId: item.productId,
      name: item.name
    }))
  )

  if (items.length > MAX_CART_UNIQUE_ITEMS) {
    issues.push({
      code: 'cart_unique_limit_exceeded',
      message: `Gio hang dang vuot gioi han ${MAX_CART_UNIQUE_ITEMS} san pham khac nhau.`
    })
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const storedPromoCode = ignoreStoredPromo ? '' : cleanString(cart.promoCode)
  const requestedPromoCode = typeof promoCode === 'string' ? cleanString(promoCode) : ''
  const effectivePromoCode = requestedPromoCode || storedPromoCode
  let promoValidation = null
  let appliedPromo = null
  let discount = 0

  if (effectivePromoCode) {
    promoValidation = parseToolPayload(
      await checkPromoCode({ code: effectivePromoCode, subtotal }, { userId })
    )

    if (promoValidation?.valid === false) {
      issues.push({
        code: 'promo_invalid',
        message: promoValidation.message || 'Ma giam gia khong hop le voi gio hang hien tai.'
      })
    } else if (promoValidation?.valid === true && !promoValidation.needsSubtotal) {
      discount = Number(promoValidation.discount || 0)
      appliedPromo = {
        code: promoValidation.promo?.code || effectivePromoCode,
        discount,
        discountFormatted: promoValidation.discountFormatted || formatPrice(discount),
        estimatedTotalFormatted: promoValidation.estimatedTotalFormatted || formatPrice(Math.max(0, subtotal - discount)),
        promo: promoValidation.promo || null
      }
    }
  }
  const estimatedTotal = Math.max(0, subtotal - discount)

  return {
    cartId: cart._id?.toString() || null,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    distinctItemCount: items.length,
    remainingSlots: Math.max(MAX_CART_UNIQUE_ITEMS - items.length, 0),
    subtotal,
    subtotalFormatted: formatPrice(subtotal),
    items,
    issues,
    hasIssues: issues.length > 0,
    promoCode: effectivePromoCode || null,
    appliedPromo,
    discount,
    discountFormatted: formatPrice(discount),
    estimatedTotal,
    estimatedTotalFormatted: formatPrice(estimatedTotal),
    promoValidation
  }
}

async function clearUserCart(userId) {
  const cart = await cartRepository.findByUserId(userId)
  if (!cart) return

  cart.items = []
  cart.promoCode = ''
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
}

async function removeOrderedItemsFromCart(userId, orderItems = []) {
  const orderedQuantityByProductId = new Map()
  for (const item of orderItems) {
    const productId = String(item?.productId || '').trim()
    if (!productId) continue
    orderedQuantityByProductId.set(
      productId,
      (orderedQuantityByProductId.get(productId) || 0) + Number(item.quantity || 0)
    )
  }

  if (orderedQuantityByProductId.size === 0) return

  const cart = await cartRepository.findByUserId(userId)
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return

  cart.items = cart.items.reduce((nextItems, item) => {
    const productId = item.productId.toString()
    const orderedQuantity = orderedQuantityByProductId.get(productId) || 0
    if (!orderedQuantity) {
      nextItems.push(item)
      return nextItems
    }

    const remainingQuantity = Number(item.quantity || 0) - orderedQuantity
    if (remainingQuantity > 0) {
      item.quantity = remainingQuantity
      nextItems.push(item)
    }

    return nextItems
  }, [])
  if (cart.items.length === 0) {
    cart.promoCode = ''
  }
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
}

function getStoredCartUnitPrice(item = {}) {
  if (item.isFlashSale && item.salePrice != null) return Number(item.salePrice)
  return Number(item.price || 0)
}

module.exports = {
  buildCartSnapshot,
  clearUserCart,
  removeOrderedItemsFromCart,
  getStoredCartUnitPrice
}










