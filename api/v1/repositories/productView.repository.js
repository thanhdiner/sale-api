const ProductView = require('../models/productView.model')

async function create(payload) {
  return ProductView.create(payload)
}

module.exports = {
  create
}
