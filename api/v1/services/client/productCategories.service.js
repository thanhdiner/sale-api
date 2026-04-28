const { buildTree, findAllDescendantIds } = require('../../helpers/product-categoryHelper')
const cache = require('../../../../config/redis')
const AppError = require('../../utils/AppError')
const productCategoryRepository = require('../../repositories/productCategory.repository')
const productRepository = require('../../repositories/product.repository')
const applyTranslation = require('../../utils/applyTranslation')

const TTL_TREE = 600
const TTL_PRODUCTS = 180
const CATEGORY_TRANSLATION_FIELDS = ['title', 'description', 'content']
const PRODUCT_TRANSLATION_FIELDS = [
  'title',
  'description',
  'content',
  'features',
  'deliveryInstructions'
]

function normalizeLanguage(lang) {
  return String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function localizeCategory(category, lang) {
  return applyTranslation(category, normalizeLanguage(lang), CATEGORY_TRANSLATION_FIELDS)
}

function localizeProduct(product, lang) {
  return applyTranslation(product, normalizeLanguage(lang), PRODUCT_TRANSLATION_FIELDS)
}

function localizeCategoryTree(items = [], lang) {
  return items.map(item => ({
    ...localizeCategory(item, lang),
    children: Array.isArray(item.children) ? localizeCategoryTree(item.children, lang) : []
  }))
}

async function getCategoryTree(lang = 'vi') {
  const result = await cache.getOrSet('categories:tree', async () => {
    const categories = await productCategoryRepository.findAll(
      {
        deleted: false,
        status: 'active'
      },
      {
        select: '_id title slug description content translations thumbnail position parent_id',
        sort: { position: -1 }
      }
    )

    return {
      code: 200,
      message: '✅ Get product categories successfully!',
      data: buildTree(categories)
    }
  }, TTL_TREE)

  return {
    ...result,
    data: localizeCategoryTree(result.data, lang)
  }
}

async function getProductsByCategorySlug(slug, lang = 'vi') {
  const cacheKey = `categories:slug:${slug}:products`

  const result = await cache.getOrSet(cacheKey, async () => {
    const category = await productCategoryRepository.findOne({
      slug,
      deleted: false,
      status: 'active'
    })

    if (!category) {
      return null
    }

    const categories = await productCategoryRepository.findAll(
      { deleted: false, status: 'active' },
      { select: '_id parent_id' }
    )
    const allCatIds = findAllDescendantIds(categories, category._id)

    const products = await productRepository.findByQuery({
      productCategory: { $in: allCatIds },
      deleted: false,
      stock: { $gt: 0 }
    })

    return {
      code: 200,
      message: '✅ Get products by category (with descendants) successfully!',
      data: products,
      category
    }
  }, TTL_PRODUCTS)

  if (!result) {
    throw new AppError('Không tìm thấy danh mục!', 404)
  }

  return {
    ...result,
    data: Array.isArray(result.data)
      ? result.data.map(product => localizeProduct(product, lang))
      : [],
    category: localizeCategory(result.category, lang)
  }
}

module.exports = {
  getCategoryTree,
  getProductsByCategorySlug
}
