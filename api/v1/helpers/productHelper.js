const Product = require('../models/products.model')

module.exports.setDefaultPosition = async body => {
  if (body.position === undefined || body.position === null || isNaN(body.position)) {
    const countProducts = await Product.countDocuments()
    body.position = countProducts + 1
  } else body.position = parseInt(body.position)
}
