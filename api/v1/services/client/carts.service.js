const AppError = require('../../utils/AppError')
const logger = require('../../../../config/logger')
const cartRepository = require('../../repositories/cart.repository')
const productRepository = require('../../repositories/product.repository')

const MAX_CART_UNIQUE_ITEMS = 50
const CART_UNIQUE_LIMIT_MESSAGE = `Gio hang chi chua toi da ${MAX_CART_UNIQUE_ITEMS} san pham khac nhau`

function isSellableProduct(product) {
  return product && product.deleted !== true && product.status === 'active'
}

function requireUserId(userId) {
  if (!userId) {
    throw new AppError('Chua dang nhap', 401)
  }
}

async function getOrCreateCart(userId) {
  let cart = await cartRepository.findByUserId(userId)
  if (!cart) {
    cart = await cartRepository.createForUser(userId)
  }
  return cart
}

function buildProductMap(products) {
  return Object.fromEntries(products.map(product => [product._id.toString(), product]))
}

async function getCart(userId) {
  requireUserId(userId)

  const cart = await getOrCreateCart(userId)
  const productIds = cart.items.map(item => item.productId)
  const products = await productRepository.findByQuery({ _id: { $in: productIds } })
  const productMap = buildProductMap(products)

  const items = cart.items.map(item => {
    const product = productMap[item.productId.toString()]
    const currentPrice =
      item.isFlashSale && item.salePrice !== undefined
        ? item.salePrice
        : product
          ? product.price * (1 - (product.discountPercentage || 0) / 100)
          : item.price

    return {
      ...item.toObject(),
      stock: product ? product.stock : 0,
      name: product ? product.title : item.name,
      image: product ? product.thumbnail : item.image,
      price: currentPrice,
      originalPrice: product ? product.price : item.price,
      inStock: product ? product.stock > 0 : false,
      discountPercentage: product ? product.discountPercentage : item.discountPercentage,
      slug: product ? product.slug : item.slug
    }
  })

  return {
    ...cart.toObject(),
    items
  }
}

async function addToCart(userId, payload = {}) {
  requireUserId(userId)

  const { productId, quantity = 1, salePrice, discountPercent, isFlashSale, flashSaleId } = payload
  if (!productId) {
    throw new AppError('Thieu productId', 400)
  }

  const product = await productRepository.findById(productId)
  if (!isSellableProduct(product)) {
    throw new AppError('Khong tim thay san pham', 404)
  }
  if (product.stock <= 0) {
    throw new AppError('San pham hien da het hang', 400, { stock: product.stock })
  }

  const cart = await getOrCreateCart(userId)
  const index = cart.items.findIndex(item => item.productId.equals(productId))

  if (index >= 0) {
    const nextQuantity = cart.items[index].quantity + quantity
    if (nextQuantity > product.stock) {
      throw new AppError(`So luong vuot qua ton kho hien co (${product.stock})`, 400, { stock: product.stock })
    }

    cart.items[index].quantity = nextQuantity
    if (isFlashSale && salePrice !== undefined) {
      cart.items[index].salePrice = salePrice
      cart.items[index].isFlashSale = true
      cart.items[index].flashSaleId = flashSaleId
      cart.items[index].discountPercentage = discountPercent
    }

    const item = cart.items[index]
    cart.items.splice(index, 1)
    cart.items.unshift(item)
  } else {
    if (cart.items.length >= MAX_CART_UNIQUE_ITEMS) {
      throw new AppError(CART_UNIQUE_LIMIT_MESSAGE, 400, { maxUniqueItems: MAX_CART_UNIQUE_ITEMS })
    }

    if (quantity > product.stock) {
      throw new AppError(`So luong vuot qua ton kho hien co (${product.stock})`, 400, { stock: product.stock })
    }

    cart.items.unshift({
      productId,
      name: product.title,
      price: product.price * (1 - (product.discountPercentage || 0) / 100),
      salePrice: isFlashSale ? salePrice : undefined,
      isFlashSale: !!isFlashSale,
      flashSaleId: flashSaleId || undefined,
      image: product.thumbnail,
      quantity,
      discountPercentage: product.discountPercentage || 0,
      slug: product.slug
    })
  }

  logger.debug('[Cart] add item:', { userId, items: cart.items.length })
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
  return cart
}

async function updateCartItem(userId, payload = {}) {
  requireUserId(userId)

  const { productId, quantity } = payload
  if (!productId || typeof quantity !== 'number' || quantity < 1) {
    throw new AppError('Du lieu khong hop le', 400)
  }

  const cart = await cartRepository.findByUserId(userId)
  if (!cart) {
    throw new AppError('Chua co gio hang', 404)
  }

  const index = cart.items.findIndex(item => item.productId.equals(productId))
  if (index < 0) {
    throw new AppError('San pham khong co trong gio', 404)
  }

  const product = await productRepository.findById(productId)
  if (!isSellableProduct(product)) {
    throw new AppError('Khong tim thay san pham', 404)
  }
  if (quantity > product.stock) {
    throw new AppError(`So luong vuot qua ton kho hien co (${product.stock})`, 400, { stock: product.stock })
  }

  cart.items[index].quantity = quantity
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
  return cart
}

async function removeFromCart(userId, productId) {
  requireUserId(userId)

  if (!productId) {
    throw new AppError('Thieu productId', 400)
  }

  const cart = await cartRepository.findByUserId(userId)
  if (!cart) {
    throw new AppError('Chua co gio hang', 404)
  }

  cart.items = cart.items.filter(item => !item.productId.equals(productId))
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
  return cart
}

async function clearCart(userId) {
  requireUserId(userId)

  const cart = await cartRepository.findByUserId(userId)
  if (!cart) {
    throw new AppError('Chua co gio hang', 404)
  }

  cart.items = []
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
  return cart
}

async function removeManyFromCart(userId, productIds) {
  requireUserId(userId)

  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new AppError('Thieu danh sach san pham', 400)
  }

  const cart = await cartRepository.findByUserId(userId)
  if (!cart) {
    throw new AppError('Chua co gio hang', 404)
  }

  cart.items = cart.items.filter(item => !productIds.includes(item.productId.toString()))
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
  return { success: true, cart }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  removeManyFromCart
}
