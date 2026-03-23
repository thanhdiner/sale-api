const Wishlist = require('../../models/wishlist.model')
const Product = require('../../models/products.model')
const logger = require('../../../../config/logger')

const getUserId = req => req.user?.userId

//# GET /api/v1/wishlist
exports.index = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })

    let wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) wishlist = await Wishlist.create({ userId, items: [] })

    const productIds = wishlist.items.map(i => i.productId)
    const products = await Product.find({ _id: { $in: productIds }, deleted: { $ne: true } })

    const productMap = {}
    products.forEach(p => {
      productMap[p._id.toString()] = p
    })

    const itemsWithDetails = wishlist.items
      .map(item => {
        const p = productMap[item.productId.toString()]
        if (!p) return null
        return {
          productId: item.productId,
          name: p.title,
          price: p.price * (1 - (p.discountPercentage || 0) / 100),
          originalPrice: p.price,
          discountPercentage: p.discountPercentage || 0,
          image: p.thumbnail,
          slug: p.slug,
          stock: p.stock,
          inStock: p.stock > 0,
          rate: p.rate
        }
      })
      .filter(Boolean)

    res.json({ items: itemsWithDetails })
  } catch (err) {
    logger.error('[Wishlist] index error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/wishlist/add
exports.add = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })

    const { productId } = req.body
    if (!productId) return res.status(400).json({ error: 'Thiếu productId' })

    const product = await Product.findOne({ _id: productId, deleted: { $ne: true } })
    if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' })

    let wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) wishlist = await Wishlist.create({ userId, items: [] })

    const exists = wishlist.items.some(i => i.productId.equals(productId))
    if (exists) {
      return res.json({ message: 'Sản phẩm đã có trong danh sách yêu thích', alreadyExists: true })
    }

    wishlist.items.unshift({ productId })
    await wishlist.save()

    logger.debug('[Wishlist] add:', { userId, productId })
    res.json({ message: 'Đã thêm vào danh sách yêu thích', success: true })
  } catch (err) {
    logger.error('[Wishlist] add error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/wishlist/remove
exports.remove = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })

    const { productId } = req.body
    if (!productId) return res.status(400).json({ error: 'Thiếu productId' })

    const wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) return res.status(404).json({ error: 'Chưa có danh sách yêu thích' })

    wishlist.items = wishlist.items.filter(i => !i.productId.equals(productId))
    await wishlist.save()

    logger.debug('[Wishlist] remove:', { userId, productId })
    res.json({ message: 'Đã xóa khỏi danh sách yêu thích', success: true })
  } catch (err) {
    logger.error('[Wishlist] remove error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/wishlist/toggle
exports.toggle = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })

    const { productId } = req.body
    if (!productId) return res.status(400).json({ error: 'Thiếu productId' })

    let wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) wishlist = await Wishlist.create({ userId, items: [] })

    const idx = wishlist.items.findIndex(i => i.productId.equals(productId))
    let added = false
    if (idx >= 0) {
      wishlist.items.splice(idx, 1)
      added = false
    } else {
      const product = await Product.findOne({ _id: productId, deleted: { $ne: true } })
      if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' })
      wishlist.items.unshift({ productId })
      added = true
    }

    await wishlist.save()
    logger.debug('[Wishlist] toggle:', { userId, productId, added })
    res.json({
      message: added ? 'Đã thêm vào danh sách yêu thích' : 'Đã xóa khỏi danh sách yêu thích',
      added,
      success: true
    })
  } catch (err) {
    logger.error('[Wishlist] toggle error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/wishlist/clear
exports.clear = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })

    const wishlist = await Wishlist.findOne({ userId })
    if (!wishlist) return res.status(404).json({ error: 'Chưa có danh sách yêu thích' })

    wishlist.items = []
    await wishlist.save()

    res.json({ message: 'Đã xóa toàn bộ danh sách yêu thích', success: true })
  } catch (err) {
    logger.error('[Wishlist] clear error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

//# GET /api/v1/wishlist/check/:productId
exports.check = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.json({ inWishlist: false })

    const { productId } = req.params
    const wishlist = await Wishlist.findOne({ userId })

    const inWishlist = wishlist ? wishlist.items.some(i => i.productId.equals(productId)) : false
    res.json({ inWishlist })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
