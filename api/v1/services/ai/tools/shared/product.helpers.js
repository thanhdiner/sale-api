/**
 * Product lookup and product payload helpers for AI tool executors.
 */

const { productRepository } = require('./dependencies')

const { cleanString, escapeRegExp } = require('./text.helpers')

function normalizeSearchTerms(rawValue = '') {
  return String(rawValue)
    .replace(/(tài khoản|acc|gói|mua|bán|giá rẻ|cần tìm|bản quyền|tháng|năm|nâng cấp|chính chủ)/gi, ' ')
    .replace(/chatgpt/gi, 'chat gpt')
    .replace(/canvapro/gi, 'canva pro')
    .trim()
}

async function findProductByQuery(productQuery) {
  const rawQuery = String(productQuery || '').trim()
  if (!rawQuery) return null

  let product = await productRepository.findOne(
    { slug: rawQuery, deleted: false },
    { populate: { path: 'productCategory', select: 'title' }, lean: true }
  )
  if (product) return product

  const exactRegex = escapeRegExp(rawQuery)
  product = await productRepository.findOne({
    deleted: false,
    $or: [
      { title: { $regex: exactRegex, $options: 'i' } },
      { titleNoAccent: { $regex: exactRegex, $options: 'i' } }
    ]
  }, {
    populate: { path: 'productCategory', select: 'title' },
    lean: true
  })
  if (product) return product

  const cleaned = normalizeSearchTerms(rawQuery)
  const terms = cleaned.split(/\s+/).filter(term => term.length > 1)
  if (terms.length === 0) return null

  return productRepository.findOne({
    deleted: false,
    $and: terms.map(term => {
      const escaped = escapeRegExp(term)
      return {
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { titleNoAccent: { $regex: escaped, $options: 'i' } }
        ]
      }
    })
  }, {
    populate: { path: 'productCategory', select: 'title' },
    lean: true
  })
}

function normalizeUserId(context = {}) {
  return context?.userId
    || context?.customerInfo?.userId
    || null
}

function isSellableProduct(product) {
  return !!product && product.deleted !== true && product.status === 'active'
}

function normalizeQuantity(quantity, fallback = null) {
  const normalized = Number(quantity)
  if (!Number.isInteger(normalized) || normalized < 1) return fallback
  return normalized
}

async function resolveProductForCartInput({ productId, productQuery } = {}) {
  if (typeof productId === 'string' && /^[0-9a-f\d]{24}$/i.test(productId.trim())) {
    const product = await productRepository.findById(productId.trim(), { lean: true })
    if (product) return product
  }

  if (typeof productQuery === 'string' && productQuery.trim()) {
    return findProductByQuery(productQuery.trim())
  }

  return null
}

function getStoredCartUnitPrice(item = {}) {
  if (item.isFlashSale && item.salePrice != null) return Number(item.salePrice)
  return Number(item.price || 0)
}

function calculateEffectiveProductPrice(product = {}) {
  return Math.round(Number(product.price || 0) * (1 - Number(product.discountPercentage || 0) / 100))
}

function getProductObject(product = {}) {
  return product && typeof product.toObject === 'function' ? product.toObject() : product
}

module.exports = {
  normalizeSearchTerms,
  findProductByQuery,
  normalizeUserId,
  isSellableProduct,
  normalizeQuantity,
  resolveProductForCartInput,
  calculateEffectiveProductPrice,
  getProductObject
}
