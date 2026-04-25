const { buildTree, findAllDescendantIds } = require('../../helpers/product-categoryHelper')
const cache = require('../../../../config/redis')
const AppError = require('../../utils/AppError')
const productCategoryRepository = require('../../repositories/productCategory.repository')
const productRepository = require('../../repositories/product.repository')

const TTL_TREE = 600
const TTL_PRODUCTS = 180

async function getCategoryTree() {
  return cache.getOrSet('categories:tree', async () => {
    const categories = await productCategoryRepository.findAll(
      {
        deleted: false,
        status: 'active'
      },
      {
        select: '_id title slug thumbnail position parent_id',
        sort: { position: -1 }
      }
    )

    return {
      code: 200,
      message: '✅ Get product categories successfully!',
      data: buildTree(categories)
    }
  }, TTL_TREE)
}

async function getProductsByCategorySlug(slug) {
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

  return result
}

module.exports = {
  getCategoryTree,
  getProductsByCategorySlug
}
