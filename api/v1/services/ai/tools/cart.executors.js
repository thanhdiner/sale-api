/**
 * AI tool executor implementations for the cart domain.
 */

const {
  buildCartSnapshot,
  calculateEffectiveProductPrice,
  cartRepository,
  checkPromoCode,
  cleanString,
  CLIENT_URL,
  DEFAULT_WISHLIST_LIMIT,
  formatPrice,
  isMongoObjectId,
  isSellableProduct,
  logger,
  MAX_CART_UNIQUE_ITEMS,
  MAX_WISHLIST_LIMIT,
  normalizeIntentText,
  normalizeQuantity,
  normalizeUserId,
  parseToolPayload,
  productRepository,
  resolveProductForCartInput,
  wishlistRepository
} = require('./tool.helpers')

function normalizeWishlistPage(value) {
  return Math.max(Number(value) || 1, 1)
}

function normalizeWishlistLimit(value) {
  return Math.min(Math.max(Number(value) || DEFAULT_WISHLIST_LIMIT, 1), MAX_WISHLIST_LIMIT)
}

async function getOrCreateWishlist(userId) {
  let wishlist = await wishlistRepository.findByUserId(userId)
  if (!wishlist) wishlist = await wishlistRepository.createForUser(userId)
  return wishlist
}

function buildWishlistProductPayload(item, product) {
  if (!product) return null

  const finalPrice = calculateEffectiveProductPrice(product)
  return {
    productId: item.productId.toString(),
    name: product.title,
    slug: product.slug,
    originalPrice: Number(product.price || 0),
    originalPriceFormatted: formatPrice(product.price || 0),
    finalPrice,
    finalPriceFormatted: formatPrice(finalPrice),
    discount: product.discountPercentage ? `${product.discountPercentage}%` : null,
    discountPercentage: product.discountPercentage || 0,
    stock: product.stock || 0,
    inStock: Number(product.stock || 0) > 0,
    image: product.thumbnail || null,
    rating: product.rate || null,
    url: product.slug ? `${CLIENT_URL}/products/${product.slug}` : null
  }
}

async function buildWishlistSnapshot(userId, { page, limit } = {}) {
  const currentPage = normalizeWishlistPage(page)
  const currentLimit = normalizeWishlistLimit(limit)
  const skip = (currentPage - 1) * currentLimit
  const wishlist = await wishlistRepository.findByUserId(userId)

  if (!wishlist || !Array.isArray(wishlist.items) || wishlist.items.length === 0) {
    return {
      wishlistId: wishlist?._id?.toString() || null,
      page: currentPage,
      limit: currentLimit,
      totalItems: 0,
      totalPages: 0,
      hasMore: false,
      items: []
    }
  }

  const allItems = [...wishlist.items].reverse()
  const totalItems = allItems.length
  const pagedItems = allItems.slice(skip, skip + currentLimit)
  const productIds = pagedItems.map(item => item.productId)
  const products = await productRepository.findByQuery(
    { _id: { $in: productIds }, deleted: { $ne: true } },
    {
      select: 'title price discountPercentage stock thumbnail slug rate status deleted',
      lean: true
    }
  )
  const productMap = new Map(products.map(product => [product._id.toString(), product]))

  return {
    wishlistId: wishlist._id?.toString() || null,
    page: currentPage,
    limit: currentLimit,
    totalItems,
    totalPages: Math.ceil(totalItems / currentLimit),
    hasMore: currentPage * currentLimit < totalItems,
    items: pagedItems
      .map(item => buildWishlistProductPayload(item, productMap.get(item.productId.toString())))
      .filter(Boolean)
  }
}

function findWishlistItemIndex(items = [], targetProductId) {
  const normalizedId = cleanString(targetProductId)
  if (!normalizedId) return -1

  return items.findIndex(item => item.productId?.toString() === normalizedId)
}

async function resolveWishlistProductInput({ productId, productQuery } = {}) {
  const product = await resolveProductForCartInput({ productId, productQuery })
  const targetProductId = product?._id
    ? product._id.toString()
    : (isMongoObjectId(productId) ? cleanString(productId) : '')

  return { product, targetProductId }
}

function getPromptIntentText(context = {}) {
  return normalizeIntentText(context.promptText || context.customerInfo?.promptText || '')
}

function hasExplicitCartAddIntent(context = {}) {
  const text = getPromptIntentText(context)
  return /(\bthem\b|\badd\b|cho vao|bo vao).{0,24}(gio|cart)/i.test(text)
    || /(gio|cart).{0,24}(\bthem\b|\badd\b|cho vao|bo vao)/i.test(text)
}

function isDirectPurchaseIntent(context = {}) {
  const text = getPromptIntentText(context)
  if (!text) return false

  return /\b(mua|dat|chot|checkout|order)\b/i.test(text)
    || /thanh toan/i.test(text)
}

function hasExplicitCartRemovalIntent(context = {}) {
  const text = getPromptIntentText(context)
  if (!text) return false

  return /\b(xoa|remove|delete|clear|loai|don)\b/i.test(text)
    || /\bbo\b.{0,24}(khoi|ra|gio|cart)/i.test(text)
    || /(khoi|ra|gio|cart).{0,24}\bbo\b/i.test(text)
}

function findCartItemIndex(items = [], { productId, productQuery, product } = {}) {
  if (!Array.isArray(items) || items.length === 0) return -1

  const resolvedProductId = product?._id ? product._id.toString() : null
  if (resolvedProductId) {
    const byResolvedProduct = items.findIndex(item => item.productId.toString() === resolvedProductId)
    if (byResolvedProduct >= 0) return byResolvedProduct
  }

  if (typeof productId === 'string' && productId.trim()) {
    const normalizedId = productId.trim()
    const byId = items.findIndex(item => item.productId.toString() === normalizedId)
    if (byId >= 0) return byId
  }

  if (typeof productQuery === 'string' && productQuery.trim()) {
    const normalizedQuery = productQuery.trim().toLowerCase()
    return items.findIndex(item =>
      String(item.slug || '').toLowerCase() === normalizedQuery
      || String(item.name || '').toLowerCase() === normalizedQuery
    )
  }

  return -1
}

async function getCart(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem gio hang.'
      })
    }

    const cart = await buildCartSnapshot(userId)

    return JSON.stringify({
      found: true,
      empty: cart.distinctItemCount === 0,
      message: cart.distinctItemCount === 0 ? 'Gio hang hien dang trong.' : null,
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] getCart error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay gio hang hien tai.' })
  }
}

async function addToCart({ productId, productQuery, quantity = 1 } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi them vao gio hang.'
      })
    }

    if (isDirectPurchaseIntent(context) && !hasExplicitCartAddIntent(context)) {
      return JSON.stringify({
        success: false,
        wrongTool: true,
        shouldUseTool: 'placeOrder',
        message: 'Khach dang yeu cau mua/dat hang truc tiep. Hay goi placeOrder voi san pham va so luong da xac dinh, khong chi them vao gio.'
      })
    }

    const normalizedQuantity = normalizeQuantity(quantity, 1)
    if (!normalizedQuantity) {
      return JSON.stringify({
        success: false,
        message: 'So luong them vao gio hang khong hop le.'
      })
    }

    const product = await resolveProductForCartInput({ productId, productQuery })
    if (!isSellableProduct(product)) {
      return JSON.stringify({
        success: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}" de them vao gio hang.`
      })
    }

    if (Number(product.stock || 0) <= 0) {
      return JSON.stringify({
        success: false,
        message: `${product.title} hien da het hang.`,
        stock: product.stock || 0
      })
    }

    let cart = await cartRepository.findByUserId(userId)
    if (!cart) cart = await cartRepository.createForUser(userId)

    const existingIndex = cart.items.findIndex(item => item.productId.equals(product._id))
    if (existingIndex >= 0) {
      const nextQuantity = Number(cart.items[existingIndex].quantity || 0) + normalizedQuantity
      if (nextQuantity > Number(product.stock || 0)) {
        return JSON.stringify({
          success: false,
          message: `So luong yeu cau vuot ton kho hien co cua ${product.title}.`,
          stock: product.stock || 0
        })
      }

      cart.items[existingIndex].quantity = nextQuantity
      const existingItem = cart.items[existingIndex]
      cart.items.splice(existingIndex, 1)
      cart.items.unshift(existingItem)
    } else {
      if (cart.items.length >= MAX_CART_UNIQUE_ITEMS) {
        return JSON.stringify({
          success: false,
          message: `Gio hang chi chua toi da ${MAX_CART_UNIQUE_ITEMS} san pham khac nhau.`,
          maxUniqueItems: MAX_CART_UNIQUE_ITEMS
        })
      }

      if (normalizedQuantity > Number(product.stock || 0)) {
        return JSON.stringify({
          success: false,
          message: `So luong yeu cau vuot ton kho hien co cua ${product.title}.`,
          stock: product.stock || 0
        })
      }

      cart.items.unshift({
        productId: product._id,
        name: product.title,
        price: calculateEffectiveProductPrice(product),
        image: product.thumbnail,
        quantity: normalizedQuantity,
        discountPercentage: product.discountPercentage || 0,
        slug: product.slug
      })
    }

    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: `Da them ${normalizedQuantity} x ${product.title} vao gio hang.`,
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] addToCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi them san pham vao gio hang.' })
  }
}

async function updateCartQuantity({ productId, productQuery, quantity } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi cap nhat gio hang.'
      })
    }

    const normalizedQuantity = normalizeQuantity(quantity)
    if (!normalizedQuantity) {
      return JSON.stringify({
        success: false,
        message: 'So luong moi khong hop le.'
      })
    }

    const cart = await cartRepository.findByUserId(userId)
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'Gio hang hien dang trong.'
      })
    }

    const product = await resolveProductForCartInput({ productId, productQuery })
    const cartItemIndex = findCartItemIndex(cart.items, { productId, productQuery, product })
    if (cartItemIndex < 0) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay san pham can cap nhat trong gio hang.'
      })
    }

    const targetItem = cart.items[cartItemIndex]
    const targetProduct = product || await productRepository.findById(targetItem.productId, { lean: true })

    if (!isSellableProduct(targetProduct)) {
      return JSON.stringify({
        success: false,
        message: 'San pham nay khong con ban tren he thong.'
      })
    }

    if (normalizedQuantity > Number(targetProduct.stock || 0)) {
      return JSON.stringify({
        success: false,
        message: `So luong yeu cau vuot ton kho hien co cua ${targetProduct.title}.`,
        stock: targetProduct.stock || 0
      })
    }

    cart.items[cartItemIndex].quantity = normalizedQuantity
    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: `Da cap nhat ${targetProduct.title} thanh ${normalizedQuantity}.`,
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] updateCartQuantity error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat so luong gio hang.' })
  }
}

async function removeFromCart({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa khoi gio hang.'
      })
    }

    if (!hasExplicitCartRemovalIntent(context)) {
      return JSON.stringify({
        success: false,
        wrongTool: true,
        shouldUseTool: 'placeOrder',
        message: 'Khach khong yeu cau xoa san pham khoi gio. Khong duoc xoa cac mon khac de dat hang; hay dung placeOrder voi dung san pham khach muon mua.'
      })
    }

    const cart = await cartRepository.findByUserId(userId)
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'Gio hang hien dang trong.'
      })
    }

    const product = await resolveProductForCartInput({ productId, productQuery })
    const cartItemIndex = findCartItemIndex(cart.items, { productId, productQuery, product })
    if (cartItemIndex < 0) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay san pham can xoa trong gio hang.'
      })
    }

    const removedItem = cart.items[cartItemIndex]
    const removedName = removedItem.name || product?.title || productQuery || productId

    cart.items.splice(cartItemIndex, 1)
    if (cart.items.length === 0) {
      cart.promoCode = ''
    }
    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: `Da xoa ${removedName} khoi gio hang.`,
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] removeFromCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa san pham khoi gio hang.' })
  }
}

async function applyPromoCodeToCart({ code } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de ap ma giam gia vao gio hang.'
      })
    }

    const normalizedCode = cleanString(code).toUpperCase()
    if (!normalizedCode) {
      return JSON.stringify({
        success: false,
        message: 'Vui long cung cap ma giam gia can ap vao gio hang.'
      })
    }

    const currentCart = await buildCartSnapshot(userId, { ignoreStoredPromo: true })
    if (currentCart.distinctItemCount === 0) {
      return JSON.stringify({
        success: false,
        message: 'Gio hang hien dang trong, chua co san pham de ap ma giam gia.',
        cart: currentCart
      })
    }

    if (currentCart.issues.length > 0) {
      return JSON.stringify({
        success: false,
        requiresCartFix: true,
        message: 'Gio hang hien co van de can xu ly truoc khi ap ma giam gia.',
        cart: currentCart
      })
    }

    const promoValidation = parseToolPayload(
      await checkPromoCode({ code: normalizedCode, subtotal: currentCart.subtotal }, { userId })
    )

    if (!promoValidation?.valid || promoValidation.needsSubtotal) {
      return JSON.stringify({
        success: false,
        applied: false,
        message: promoValidation?.message || 'Ma giam gia khong hop le voi gio hang hien tai.',
        promoValidation,
        cart: currentCart
      })
    }

    const cartDoc = await cartRepository.findByUserId(userId)
    if (!cartDoc) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay gio hang de ap ma giam gia.'
      })
    }

    cartDoc.promoCode = normalizedCode
    cartDoc.updatedAt = new Date()
    await cartRepository.save(cartDoc)

    const cart = await buildCartSnapshot(userId)

    return JSON.stringify({
      success: true,
      applied: true,
      message: promoValidation.message || `Da ap ma giam gia ${normalizedCode} vao gio hang.`,
      promo: cart.appliedPromo,
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] applyPromoCodeToCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi ap ma giam gia vao gio hang.' })
  }
}

async function validateCart({ promoCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        valid: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de kiem tra gio hang.'
      })
    }

    const cart = await buildCartSnapshot(userId, { promoCode })

    return JSON.stringify({
      valid: !cart.hasIssues,
      message: cart.hasIssues
        ? 'Gio hang hien co mot vai van de can xu ly truoc khi dat hang.'
        : 'Gio hang hop le va san sang cho buoc tiep theo.',
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] validateCart error:', err.message)
    return JSON.stringify({ valid: false, error: 'Loi khi kiem tra gio hang.' })
  }
}

async function removePromoCodeFromCart({ code } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de go ma giam gia khoi gio hang.'
      })
    }

    const normalizedCode = cleanString(code)
    const cartDoc = await cartRepository.findByUserId(userId)
    if (!cartDoc) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay gio hang de go ma giam gia.'
      })
    }

    const removedPromoCode = normalizedCode || cleanString(cartDoc.promoCode) || null
    cartDoc.promoCode = ''
    cartDoc.updatedAt = new Date()
    await cartRepository.save(cartDoc)
    const cart = await buildCartSnapshot(userId)

    return JSON.stringify({
      success: true,
      promoRemoved: true,
      removedPromoCode,
      message: removedPromoCode
        ? `Da go ma giam gia ${removedPromoCode} khoi gio hang.`
        : 'Da go ma giam gia khoi gio hang.',
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] removePromoCodeFromCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi go ma giam gia khoi gio hang.' })
  }
}

async function clearCart(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa gio hang.'
      })
    }

    const cart = await cartRepository.findByUserId(userId)
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return JSON.stringify({
        success: true,
        message: 'Gio hang da trong san.'
      })
    }

    cart.items = []
    cart.promoCode = ''
    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: 'Da xoa toan bo gio hang.',
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] clearCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa toan bo gio hang.' })
  }
}

async function getWishlist({ page, limit } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem danh sach yeu thich.'
      })
    }

    const wishlist = await buildWishlistSnapshot(userId, { page, limit })

    return JSON.stringify({
      found: true,
      empty: wishlist.totalItems === 0,
      message: wishlist.totalItems === 0 ? 'Danh sach yeu thich hien dang trong.' : null,
      wishlist
    })
  } catch (err) {
    logger.error('[AI Tool] getWishlist error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay danh sach yeu thich.' })
  }
}

async function addToWishlist({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi them san pham vao danh sach yeu thich.'
      })
    }

    const { product } = await resolveWishlistProductInput({ productId, productQuery })
    if (!isSellableProduct(product)) {
      return JSON.stringify({
        success: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}" de them vao danh sach yeu thich.`
      })
    }

    const wishlist = await getOrCreateWishlist(userId)
    const exists = findWishlistItemIndex(wishlist.items, product._id.toString()) >= 0
    if (exists) {
      return JSON.stringify({
        success: true,
        alreadyExists: true,
        message: `${product.title} da co trong danh sach yeu thich.`,
        wishlist: await buildWishlistSnapshot(userId)
      })
    }

    wishlist.items.unshift({ productId: product._id })
    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      added: true,
      message: `Da them ${product.title} vao danh sach yeu thich.`,
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] addToWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi them san pham vao danh sach yeu thich.' })
  }
}

async function removeFromWishlist({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa san pham khoi danh sach yeu thich.'
      })
    }

    const wishlist = await wishlistRepository.findByUserId(userId)
    if (!wishlist || !Array.isArray(wishlist.items) || wishlist.items.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'Danh sach yeu thich hien dang trong.'
      })
    }

    const { product, targetProductId } = await resolveWishlistProductInput({ productId, productQuery })
    const itemIndex = findWishlistItemIndex(wishlist.items, targetProductId)
    if (itemIndex < 0) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay san pham can xoa trong danh sach yeu thich.'
      })
    }

    const removedItem = wishlist.items[itemIndex]
    const removedProduct = product || await productRepository.findById(removedItem.productId, { lean: true })
    const removedName = removedProduct?.title || productQuery || productId || 'san pham'

    wishlist.items.splice(itemIndex, 1)
    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      removed: true,
      message: `Da xoa ${removedName} khoi danh sach yeu thich.`,
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] removeFromWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa san pham khoi danh sach yeu thich.' })
  }
}

async function toggleWishlist({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi cap nhat danh sach yeu thich.'
      })
    }

    const wishlist = await getOrCreateWishlist(userId)
    const { product, targetProductId } = await resolveWishlistProductInput({ productId, productQuery })
    if (!targetProductId) {
      return JSON.stringify({
        success: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}" de cap nhat danh sach yeu thich.`
      })
    }

    const existingIndex = findWishlistItemIndex(wishlist.items, targetProductId)
    let added = false
    let productName = product?.title || productQuery || productId || 'san pham'

    if (existingIndex >= 0) {
      const removedItem = wishlist.items[existingIndex]
      if (!product) {
        const removedProduct = await productRepository.findById(removedItem.productId, { lean: true })
        productName = removedProduct?.title || productName
      }
      wishlist.items.splice(existingIndex, 1)
    } else {
      if (!isSellableProduct(product)) {
        return JSON.stringify({
          success: false,
          message: `Khong tim thay san pham "${productQuery || productId || ''}" de them vao danh sach yeu thich.`
        })
      }

      wishlist.items.unshift({ productId: product._id })
      productName = product.title
      added = true
    }

    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      added,
      removed: !added,
      message: added
        ? `Da them ${productName} vao danh sach yeu thich.`
        : `Da xoa ${productName} khoi danh sach yeu thich.`,
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] toggleWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat danh sach yeu thich.' })
  }
}

async function clearWishlist(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa danh sach yeu thich.'
      })
    }

    const wishlist = await wishlistRepository.findByUserId(userId)
    if (!wishlist || !Array.isArray(wishlist.items) || wishlist.items.length === 0) {
      return JSON.stringify({
        success: true,
        message: 'Danh sach yeu thich da trong san.',
        wishlist: await buildWishlistSnapshot(userId)
      })
    }

    wishlist.items = []
    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      message: 'Da xoa toan bo danh sach yeu thich.',
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] clearWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa toan bo danh sach yeu thich.' })
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  applyPromoCodeToCart,
  validateCart,
  removePromoCodeFromCart,
  clearCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist
}












