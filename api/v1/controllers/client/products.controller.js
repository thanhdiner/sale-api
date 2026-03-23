const Product = require('../../models/products.model')
const productsHelper = require('../../helpers/product')
const cache = require('../../../../config/redis')

// TTL (giây)
const TTL_LIST = 180    // 3 phút
const TTL_DETAIL = 300  // 5 phút
const TTL_SUGGEST = 60  // 1 phút

//# GET /products
module.exports.index = async (req, res) => {
  try {
    const search    = (req.query.search || '').replace(/\+/g, ' ')
    const sort      = req.query.sort || 'newest'
    const page      = parseInt(req.query.page)  || 1
    const limit     = parseInt(req.query.limit) || 20
    const isTopDeal = req.query.isTopDeal || ''
    const isFeatured= req.query.isFeatured || ''

    // ─── Advanced filters ───────────────────────────
    const minPrice  = parseFloat(req.query.minPrice) || 0
    const maxPrice  = parseFloat(req.query.maxPrice) || 0
    const category  = req.query.category  || ''   // ObjectId string
    const minRate   = parseFloat(req.query.minRate) || 0
    const inStock   = req.query.inStock || ''     // 'true' | 'false' | ''

    const hasAdvanced = minPrice > 0 || maxPrice > 0 || category || minRate > 0 || inStock !== ''

    const cacheKey = `products:list:${search}:${sort}:${page}:${limit}:${isTopDeal}:${isFeatured}`

    const fetchFn = async () => {
      const query = {
        status: 'active',
        deleted: false
      }

      // Stock filter
      if (inStock === 'true')  query.stock = { $gt: 0 }
      else if (inStock === 'false') query.stock = 0
      else query.stock = { $gt: 0 } // default: chỉ còn hàng

      const skip = (page - 1) * limit

      if (isTopDeal  === 'true') query.isTopDeal  = true
      if (isFeatured === 'true') query.isFeatured = true
      if (search)   query.titleNoAccent = { $regex: search, $options: 'i' }
      if (category) query.productCategory = category
      if (minRate > 0) query.rate = { $gte: minRate }

      // Price filter (áp dụng lên giá sau giảm)
      if (minPrice > 0 || maxPrice > 0) {
        query.$expr = {
          $and: [
            ...(minPrice > 0 ? [{
              $gte: [
                { $subtract: ['$price', { $multiply: ['$price', { $divide: ['$discountPercentage', 100] }] }] },
                minPrice
              ]
            }] : []),
            ...(maxPrice > 0 ? [{
              $lte: [
                { $subtract: ['$price', { $multiply: ['$price', { $divide: ['$discountPercentage', 100] }] }] },
                maxPrice
              ]
            }] : [])
          ]
        }
      }

      let sortObj = { createdAt: -1 }
      switch (sort) {
        case 'price_asc':   sortObj = { price: 1 };           break
        case 'price_desc':  sortObj = { price: -1 };          break
        case 'name_asc':    sortObj = { title: 1 };           break
        case 'name_desc':   sortObj = { title: -1 };          break
        case 'sold_desc':   sortObj = { soldQuantity: -1 };   break
        case 'rate_desc':   sortObj = { rate: -1 };           break
        case 'newest':
        default:            sortObj = { createdAt: -1 };      break
      }

      const total = await Product.countDocuments(query)
      const products = await Product.find(query).sort(sortObj).skip(skip).limit(limit)
      const newProduct = productsHelper.priceNewProducts(products)
      return { data: newProduct, total }
    }

    // Không cache khi có filter nâng cao (tránh key quá dài / collision)
    const result = hasAdvanced
      ? await fetchFn()
      : await cache.getOrSet(cacheKey, fetchFn, TTL_LIST)

    res.json(result)
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

    const limit = parseInt(req.query.limit || 8)
    const cacheKey = `products:suggest:${queryStr.toLowerCase()}:${limit}`

    const result = await cache.getOrSet(cacheKey, async () => {
      const suggestions = await Product.find({
        titleNoAccent: { $regex: queryStr, $options: 'i' },
        deleted: false,
        status: 'active',
        stock: { $gt: 0 }
      })
        .sort({ sold: -1, position: -1 })
        .limit(limit)
        .select('title -_id')

      return { suggestions: suggestions.map(s => s.title) }
    }, TTL_SUGGEST)

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# GET /products/:slug
module.exports.detail = async (req, res) => {
  try {
    const { slug } = req.params
    const cacheKey = `products:detail:${slug}`

    const result = await cache.getOrSet(cacheKey, async () => {
      const product = await Product.findOne({
        deleted: false,
        status: 'active',
        slug
      }).populate('productCategory')

      if (!product) return null

      product.priceNew = productsHelper.priceNewProduct(product)
      return product.toObject ? { ...product.toObject(), priceNew: product.priceNew } : product
    }, TTL_DETAIL)

    if (!result) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' })

    res.json(result)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}
