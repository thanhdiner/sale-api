const ProductCategory = require('../../models/product-category.model')
const { buildTree } = require('../../helpers/product-categoryHelper')

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
    console.error('Get public categories error:', err)
    res.status(500).json({
      error: 'Failed to get product categories',
      status: 500
    })
  }
}
