const Product = require('../models/products.model')
const productsHelper = require('../helpers/product')

//# Get /products
module.exports.index = async (req, res) => {
  try {
    const products = await Product.find({
      status: 'active',
      deleted: 'false'
    }).sort({ position: 'desc' })

    const newProduct = productsHelper.priceNewProducts(products)

    res.json(newProduct)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# Get /products/:slug
module.exports.detail = async (req, res) => {
  try {
    const product = await Product.findOne({
      deleted: false,
      status: 'active',
      slug: req.params.slug
    })

    product.priceNew = productsHelper.priceNewProduct(product)

    res.json(product)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}
