const Product = require('../../models/products.model')
const productsHelper = require('../../helpers/product')

//# GET /products
module.exports.index = async (req, res) => {
  try {
    const search = req.query.search || ''
    const sort = req.query.sort || 'newest'

    const query = {
      status: 'active',
      deleted: false
    }

    if (req.query.isTopDeal === 'true') query.isTopDeal = true
    if (req.query.isFeatured === 'true') query.isFeatured = true

    if (search) query.titleNoAccent = { $regex: search, $options: 'i' }

    let sortObj = { position: -1 }
    switch (sort) {
      case 'price_asc':
        sortObj = { price: 1 }
        break
      case 'price_desc':
        sortObj = { price: -1 }
        break
      case 'name_asc':
        sortObj = { title: 1 }
        break
      case 'name_desc':
        sortObj = { title: -1 }
        break
      case 'newest':
      default:
        sortObj = { createdAt: -1 }
        break
    }

    const products = await Product.find(query).sort(sortObj)

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
