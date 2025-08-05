const Product = require('../../models/products.model')
const productsHelper = require('../../helpers/product')

//# GET /products
module.exports.index = async (req, res) => {
  try {
    const search = (req.query.search || '').replace(/\+/g, ' ')
    const sort = req.query.sort || 'newest'

    const query = {
      status: 'active',
      deleted: false,
      stock: { $gt: 0 }
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

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

    const total = await Product.countDocuments(query)
    const products = await Product.find(query).sort(sortObj).skip(skip).limit(limit)

    const newProduct = productsHelper.priceNewProducts(products)
    res.json({
      data: newProduct,
      total
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# GET /products/suggest
module.exports.suggest = async (req, res) => {
  try {
    const rawQuery = req.query.query || ''
    const queryStr = rawQuery.replace(/\+/g, ' ')
    if (!queryStr.trim()) return res.json({ suggestions: [] })

    const suggestions = await Product.find({
      titleNoAccent: { $regex: queryStr, $options: 'i' },
      deleted: false,
      status: 'active',
      stock: { $gt: 0 }
    })
      .sort({ sold: -1, position: -1 })
      .limit(parseInt(req.query.limit || 8))
      .select('title -_id')

    res.json({
      suggestions: suggestions.map(s => s.title)
    })
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
    }).populate('productCategory')

    product.priceNew = productsHelper.priceNewProduct(product)

    res.json(product)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}
