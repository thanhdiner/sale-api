/**
 * Product lookup and product payload helpers for AI tool executors.
 */

const { productRepository, removeAccents } = require('./dependencies')
const { cleanString, escapeRegExp } = require('./text.helpers')

const SEARCH_INTENT_PHRASES = [
  'toi muon',
  'minh muon',
  'tui muon',
  'muon mua',
  'can mua',
  'can tim',
  'tim kiem',
  'tai khoan',
  'phan mem',
  'ban quyen',
  'gia re',
  'nang cap',
  'chinh chu'
]

const SEARCH_INTENT_TOKENS = new Set([
  'toi',
  'minh',
  'tui',
  'em',
  'anh',
  'chi',
  'ban',
  'muon',
  'muuon',
  'muyoosn',
  'muoosn',
  'muosn',
  'mua',
  'can',
  'tim',
  'kiem',
  'xem',
  'hoi',
  'gia',
  're',
  'goi',
  'acc',
  'account',
  'khac',
  'thang',
  'nam',
  'dang',
  'con',
  'hang'
])

const SEARCH_TERM_SYNONYMS = {
  gpt: ['gpt', 'chatgpt', 'chat gpt', 'openai', 'open ai'],
  chatgpt: ['chatgpt', 'chat gpt', 'gpt', 'openai', 'open ai'],
  openai: ['openai', 'open ai', 'chatgpt', 'chat gpt', 'gpt'],
  ai: ['ai', 'openai', 'open ai', 'chatgpt', 'chat gpt', 'gpt']
}

function normalizeCatalogSearchText(rawValue = '') {
  let normalized = removeAccents(String(rawValue || '').toLowerCase())
    .replace(/chat\s*gpt|chatgpt/g, ' chat gpt ')
    .replace(/open\s*ai|openai/g, ' openai ')
    .replace(/canva\s*pro|canvapro/g, ' canva pro ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  SEARCH_INTENT_PHRASES.forEach(phrase => {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'g'), ' ')
  })

  return normalized
    .split(/\s+/)
    .filter(term => term && !SEARCH_INTENT_TOKENS.has(term))
    .join(' ')
}

function normalizeSearchTerms(rawValue = '') {
  return normalizeCatalogSearchText(rawValue)
}

function normalizeSearchTermVariants(term = '') {
  const normalizedTerm = normalizeCatalogSearchText(term)
  const compactTerm = normalizedTerm.replace(/\s+/g, '')
  const aliases = [
    normalizedTerm,
    compactTerm,
    ...(SEARCH_TERM_SYNONYMS[normalizedTerm] || []),
    ...(SEARCH_TERM_SYNONYMS[compactTerm] || [])
  ]

  return [...new Set(
    aliases
      .map(alias => cleanString(alias))
      .filter(Boolean)
  )]
}

function buildProductTextSearchConditions(variant) {
  const escaped = escapeRegExp(variant)

  return [
    { title: { $regex: escaped, $options: 'i' } },
    { titleNoAccent: { $regex: escaped, $options: 'i' } },
    { description: { $regex: escaped, $options: 'i' } },
    { content: { $regex: escaped, $options: 'i' } },
    { features: { $regex: escaped, $options: 'i' } },
    { 'translations.en.title': { $regex: escaped, $options: 'i' } },
    { 'translations.en.description': { $regex: escaped, $options: 'i' } },
    { 'translations.en.content': { $regex: escaped, $options: 'i' } }
  ]
}

async function findProductByQuery(productQuery) {
  const rawQuery = String(productQuery || '').trim()
  if (!rawQuery) return null

  let product = await productRepository.findOne(
    { slug: rawQuery, deleted: false },
    { populate: { path: 'productCategory', select: 'title' }, lean: true }
  )
  if (product) return product

  product = await productRepository.findOne({
    deleted: false,
    $or: buildProductTextSearchConditions(rawQuery)
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
    $and: terms.map(term => ({
      $or: normalizeSearchTermVariants(term).flatMap(buildProductTextSearchConditions)
    }))
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
  normalizeSearchTermVariants,
  findProductByQuery,
  normalizeUserId,
  isSellableProduct,
  normalizeQuantity,
  resolveProductForCartInput,
  calculateEffectiveProductPrice,
  getProductObject
}
