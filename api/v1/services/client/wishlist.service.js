const logger = require('../../../../config/logger')
const AppError = require('../../utils/AppError')
const wishlistRepository = require('../../repositories/wishlist.repository')
const productRepository = require('../../repositories/product.repository')

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 50

function requireUserId(userId) {
  if (!userId) {
    throw new AppError('Chua dang nhap', 401)
  }
}

function normalizePage(page) {
  return Math.max(Number(page) || DEFAULT_PAGE, 1)
}

function normalizeLimit(limit) {
  return Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
}

async function getOrCreateWishlist(userId) {
  let wishlist = await wishlistRepository.findByUserId(userId)

  if (!wishlist) {
    wishlist = await wishlistRepository.createForUser(userId)
  }

  return wishlist
}

function mapProductsById(products) {
  return Object.fromEntries(products.map(product => [product._id.toString(), product]))
}

function serializeWishlistItem(item, product) {
  if (!product) return null

  return {
    productId: item.productId,
    title: product.title,
    name: product.title,
    translations: product.translations || {},
    price: product.price * (1 - (product.discountPercentage || 0) / 100),
    originalPrice: product.price,
    discountPercentage: product.discountPercentage || 0,
    image: product.thumbnail,
    slug: product.slug,
    stock: product.stock,
    inStock: product.stock > 0,
    rate: product.rate
  }
}

async function getWishlist({ userId, page, limit }) {
  requireUserId(userId)

  const currentPage = normalizePage(page)
  const currentLimit = normalizeLimit(limit)
  const skip = (currentPage - 1) * currentLimit

  const wishlist = await getOrCreateWishlist(userId)

  // Keep the latest-added items first in the response.
  const allItems = [...wishlist.items].reverse()
  const totalItems = allItems.length
  const pagedItems = allItems.slice(skip, skip + currentLimit)
  const productIds = pagedItems.map(item => item.productId)
  const products = await productRepository.findByIdsNotDeleted(productIds)
  const productMap = mapProductsById(products)

  return {
    items: pagedItems
      .map(item => serializeWishlistItem(item, productMap[item.productId.toString()]))
      .filter(Boolean),
    pagination: {
      page: currentPage,
      limit: currentLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / currentLimit),
      hasMore: currentPage * currentLimit < totalItems
    }
  }
}

async function addWishlistItem({ userId, productId }) {
  requireUserId(userId)

  if (!productId) {
    throw new AppError('Thieu productId', 400)
  }

  const product = await productRepository.findByIdNotDeleted(productId)
  if (!product) {
    throw new AppError('Khong tim thay san pham', 404)
  }

  const wishlist = await getOrCreateWishlist(userId)
  const exists = wishlist.items.some(item => item.productId.equals(productId))

  if (exists) {
    return {
      message: 'San pham da co trong danh sach yeu thich',
      alreadyExists: true
    }
  }

  wishlist.items.unshift({ productId })
  await wishlistRepository.save(wishlist)

  logger.debug('[Wishlist] add:', { userId, productId })

  return {
    message: 'Da them vao danh sach yeu thich',
    success: true
  }
}

async function removeWishlistItem({ userId, productId }) {
  requireUserId(userId)

  if (!productId) {
    throw new AppError('Thieu productId', 400)
  }

  const wishlist = await wishlistRepository.findByUserId(userId)
  if (!wishlist) {
    throw new AppError('Chua co danh sach yeu thich', 404)
  }

  wishlist.items = wishlist.items.filter(item => !item.productId.equals(productId))
  await wishlistRepository.save(wishlist)

  return {
    message: 'Da xoa khoi danh sach yeu thich',
    success: true
  }
}

async function toggleWishlistItem({ userId, productId }) {
  requireUserId(userId)

  if (!productId) {
    throw new AppError('Thieu productId', 400)
  }

  const wishlist = await getOrCreateWishlist(userId)
  const existingIndex = wishlist.items.findIndex(item => item.productId.equals(productId))
  let added = false

  if (existingIndex >= 0) {
    wishlist.items.splice(existingIndex, 1)
  } else {
    const product = await productRepository.findByIdNotDeleted(productId)
    if (!product) {
      throw new AppError('Khong tim thay san pham', 404)
    }

    wishlist.items.unshift({ productId })
    added = true
  }

  await wishlistRepository.save(wishlist)
  logger.debug('[Wishlist] toggle:', { userId, productId, added })

  return {
    message: added ? 'Da them vao danh sach yeu thich' : 'Da xoa khoi danh sach yeu thich',
    added,
    success: true
  }
}

async function clearWishlist({ userId }) {
  requireUserId(userId)

  const wishlist = await wishlistRepository.findByUserId(userId)
  if (!wishlist) {
    throw new AppError('Chua co danh sach yeu thich', 404)
  }

  wishlist.items = []
  await wishlistRepository.save(wishlist)

  return {
    message: 'Da xoa toan bo danh sach yeu thich',
    success: true
  }
}

async function checkWishlistItem({ userId, productId }) {
  if (!userId) {
    return { inWishlist: false }
  }

  const wishlist = await wishlistRepository.findByUserId(userId)
  const inWishlist = wishlist ? wishlist.items.some(item => item.productId.equals(productId)) : false

  return { inWishlist }
}

module.exports = {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  toggleWishlistItem,
  clearWishlist,
  checkWishlistItem
}
