const mongoose = require('mongoose')
const homeBuildYourKitContentRepository = require('../../../repositories/cms/homeBuildYourKitContent.repository')
const productRepository = require('../../../repositories/product/product.repository')
const cache = require('../../../../../config/redis')
const {
  localizeFlatContent,
  normalizeLanguage
} = require('../../../factories/singletonContent.factory')
const { normalizeContent } = require('../../../services/admin/cms/homeBuildYourKitContent.service')
const applyTranslation = require('../../../utils/applyTranslation')

const TTL_HOME_BUILD_YOUR_KIT_CONTENT = 600
const PRODUCT_SELECT = '_id title slug thumbnail price discountPercentage stock status deleted translations productCategory'
const PRODUCT_TRANSLATION_FIELDS = ['title']

function getProductIds(content = {}) {
  return [...new Set((content.kits || [])
    .flatMap(kit => kit.products || [])
    .map(item => item.productId)
    .filter(value => value && mongoose.Types.ObjectId.isValid(value))
    .map(String))]
}

function getProductSlugs(content = {}) {
  return [...new Set((content.kits || [])
    .flatMap(kit => kit.products || [])
    .map(item => item.productSlug)
    .filter(Boolean)
    .map(String))]
}

function getSalePrice(product) {
  const price = Number(product?.price || 0)
  const discountPercentage = Number(product?.discountPercentage || 0)
  return Math.round((price * (100 - discountPercentage)) / 100)
}

function mapProduct(product, language) {
  const localized = applyTranslation(product, language, PRODUCT_TRANSLATION_FIELDS)

  return {
    id: localized._id?.toString(),
    title: localized.title || '',
    slug: localized.slug || '',
    thumbnail: localized.thumbnail || '',
    price: Number(localized.price || 0),
    priceNew: getSalePrice(localized),
    discountPercentage: Number(localized.discountPercentage || 0),
    stock: Number(localized.stock || 0),
    status: localized.status || 'inactive'
  }
}

async function resolveProductRefs(content = {}, language = 'vi') {
  const productIds = getProductIds(content)
  const productSlugs = getProductSlugs(content)

  if (!productIds.length && !productSlugs.length) return content

  const products = await productRepository.findByQuery({
    deleted: false,
    status: 'active',
    stock: { $gt: 0 },
    $or: [
      ...(productIds.length ? [{ _id: { $in: productIds } }] : []),
      ...(productSlugs.length ? [{ slug: { $in: productSlugs } }] : [])
    ]
  }, {
    select: PRODUCT_SELECT,
    lean: true
  })

  const productById = new Map()
  const productBySlug = new Map()

  products.forEach(product => {
    const mapped = mapProduct(product, language)
    if (mapped.id) productById.set(mapped.id, mapped)
    if (mapped.slug) productBySlug.set(mapped.slug, mapped)
  })

  return {
    ...content,
    kits: (content.kits || []).map(kit => ({
      ...kit,
      products: (kit.products || [])
        .map(item => {
          const product = productById.get(String(item.productId || '')) || productBySlug.get(String(item.productSlug || '')) || null
          if (!product && (item.productId || item.productSlug) && !item.categorySlugFallback && !item.customLabel && !item.customImage) return null

          return {
            ...item,
            product,
            unavailable: Boolean((item.productId || item.productSlug) && !product)
          }
        })
        .filter(Boolean)
        .slice(0, 8)
    }))
  }
}

async function getHomeBuildYourKitContent(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)
  const cacheKey = `home-build-your-kit:content:${normalizedLanguage}`

  return cache.getOrSet(cacheKey, async () => {
    const document = await homeBuildYourKitContentRepository.findOne({ lean: true })
    const localized = localizeFlatContent(document, normalizedLanguage, { arrayFilter: 'defined' })
    if (!localized) {
      return {
        message: 'Home build your kit content fetched successfully',
        data: null
      }
    }

    const normalized = normalizeContent(localized)
    const data = await resolveProductRefs(normalized, normalizedLanguage)

    return {
      message: 'Home build your kit content fetched successfully',
      data
    }
  }, TTL_HOME_BUILD_YOUR_KIT_CONTENT)
}

module.exports = {
  getHomeBuildYourKitContent,
  resolveProductRefs
}
