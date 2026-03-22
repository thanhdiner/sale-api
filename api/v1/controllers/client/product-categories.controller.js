const ProductCategory = require('../../models/product-category.model')
const Product = require('../../models/products.model')
const { buildTree, findAllDescendantIds } = require('../../helpers/product-categoryHelper')
const logger = require('../../../../config/logger')
const cache = require('../../../../config/redis')

const TTL_TREE = 600    // 10 phút — category ít thay đổi
const TTL_PRODUCTS = 180 // 3 phút

//# GET /api/v1/product-categories/tree
module.exports.index = async (req, res) => {
  try {
    const cacheKey = 'categories:tree'

    const result = await cache.getOrSet(cacheKey, async () => {
      const categories = await ProductCategory.find({
        deleted: false,
        status: 'active'
      })
        .select('_id title slug thumbnail position parent_id')
        .sort({ position: -1 })

      return {
        code: 200,
        message: '✅ Get product categories successfully!',
        data: buildTree(categories)
      }
    }, TTL_TREE)

    res.json(result)
  } catch (err) {
    logger.error('[Client] Get public categories error:', err)
    res.status(500).json({ error: 'Failed to get product categories', status: 500 })
  }
}

//# GET /api/v1/product-categories/:slug/products
module.exports.getProductsByCategorySlug = async (req, res) => {
  try {
    const { slug } = req.params
    const cacheKey = `categories:slug:${slug}:products`

    const result = await cache.getOrSet(cacheKey, async () => {
      const category = await ProductCategory.findOne({ slug, deleted: false, status: 'active' })
      if (!category) return null

      const categories = await ProductCategory.find({ deleted: false, status: 'active' }).select('_id parent_id')
      const allCatIds = findAllDescendantIds(categories, category._id)

      const products = await Product.find({
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

    if (!result) return res.status(404).json({ message: 'Không tìm thấy danh mục!' })

    res.json(result)
  } catch (err) {
    logger.error('[Client] Get products by category error:', err)
    res.status(500).json({ error: 'Failed to get products by category', status: 500 })
  }
}
