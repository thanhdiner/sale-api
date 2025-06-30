const Product = require('../models/products.model')

module.exports.parseIntegerFields = (body, fields) => {
  fields.forEach(field => {
    if (body[field] !== undefined) body[field] = parseInt(body[field])
  })
}

module.exports.setDefaultPosition = async body => {
  if (body.position === undefined || body.position === null || isNaN(body.position)) {
    const countProducts = await Product.countDocuments()
    body.position = countProducts + 1
  } else body.position = parseInt(body.position)
}
