const ProductCategory = require('../models/product-category.model')
const Product = require('../models/products.model')

module.exports.setDefaultPosition = async body => {
  if (body.position === undefined || body.position === null || isNaN(body.position)) {
    const countProducts = await Product.countDocuments()
    body.position = countProducts + 1
  } else body.position = parseInt(body.position)
}

module.exports.validateProductCategory = async productCategoryId => {
  if (!productCategoryId) return null
  const category = await ProductCategory.findOne({
    _id: productCategoryId,
    deleted: false
  })
  return category
}
