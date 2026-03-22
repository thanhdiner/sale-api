const ProductCategory = require('../../models/product-category.model')
const Product = require('../../models/products.model')
const { buildTree, findAllDescendantIds } = require('../../helpers/product-categoryHelper')
const logger = require('../../../../config/logger')

//# GET /api/v1/product-categories/tree
module.exports.index = async (req, res) => {
  try {
    const categories = await ProductCategory.find({
      deleted: false,
      status: 'active'
    })
      .select('_id title slug thumbnail position parent_id')
      .sort({ position: -1 })

    const tree = buildTree(categories)

    res.json({
      code: 200,
      message: '✅ Get product categories successfully!',
      data: tree
    })
  } catch (err) {
    logger.error('[Client] Get public categories error:', err)
    res.status(500).json({
      error: 'Failed to get product categories',
      status: 500
    })
  }
}

//# GET /api/v1/product-categories/:slug/products
module.exports.getProductsByCategorySlug = async (req, res) => {
  try {
    const { slug } = req.params
    const category = await ProductCategory.findOne({ slug, deleted: false, status: 'active' })
    if (!category) return res.status(404).json({ message: 'Không tìm thấy danh mục!' })

    const categories = await ProductCategory.find({ deleted: false, status: 'active' }).select('_id parent_id')
    const allCatIds = findAllDescendantIds(categories, category._id)

    const products = await Product.find({
      productCategory: { $in: allCatIds },
      deleted: false,
      stock: { $gt: 0 }
    })

    res.json({
      code: 200,
      message: '✅ Get products by category (with descendants) successfully!',
      data: products,
      category
    })
  } catch (err) {
    logger.error('[Client] Get products by category error:', err)
    res.status(500).json({
      error: 'Failed to get products by category',
      status: 500
    })
  }
}
