const Cart = require('../../models/cart.model')
const Product = require('../../models/products.model')
const logger = require('../../../../config/logger')

const getUserId = req => req.user?.userId

//# GET /api/v1/cart
exports.index = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })
    let cart = await Cart.findOne({ userId })
    if (!cart) cart = await Cart.create({ userId, items: [] })

    const productIds = cart.items.map(i => i.productId)
    const products = await Product.find({ _id: { $in: productIds } })

    const productMap = {}
    products.forEach(p => {
      productMap[p._id.toString()] = p
    })

    const itemsWithStock = cart.items.map(item => {
      const p = productMap[item.productId.toString()]
      let priceToUse =
        item.isFlashSale && item.salePrice !== undefined
          ? item.salePrice
          : p
          ? p.price * (1 - (p.discountPercentage || 0) / 100)
          : item.price
      return {
        ...item.toObject(),
        stock: p ? p.stock : 0,
        name: p ? p.title : item.name,
        image: p ? p.thumbnail : item.image,
        price: priceToUse,
        originalPrice: p ? p.price : item.price,
        inStock: p ? p.stock > 0 : false,
        discountPercentage: p ? p.discountPercentage : item.discountPercentage,
        slug: p ? p.slug : item.slug
      }
    })

    res.json({
      ...cart.toObject(),
      items: itemsWithStock
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/cart/add
exports.add = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })
    const { productId, quantity = 1, salePrice, discountPercent, isFlashSale, flashSaleId } = req.body
    if (!productId) return res.status(400).json({ error: 'Thiếu productId' })

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' })

    let cart = await Cart.findOne({ userId })
    if (!cart) cart = await Cart.create({ userId, items: [] })

    const idx = cart.items.findIndex(i => i.productId.equals(productId))
    if (idx >= 0) {
      cart.items[idx].quantity += quantity
      // update giá nếu là flashsale, tránh user đổi sang normal price
      if (isFlashSale && salePrice !== undefined) {
        // <-- CHỈ SỬA Ở ĐÂY
        cart.items[idx].salePrice = salePrice
        cart.items[idx].isFlashSale = true
        cart.items[idx].flashSaleId = flashSaleId
        cart.items[idx].discountPercentage = discountPercent
      }
      const item = cart.items[idx]
      cart.items.splice(idx, 1)
      cart.items.unshift(item)
    } else {
      cart.items.unshift({
        productId,
        name: product.title,
        price: product.price * (1 - (product.discountPercentage || 0) / 100),
        salePrice: isFlashSale ? salePrice : undefined,
        isFlashSale: !!isFlashSale,
        flashSaleId: flashSaleId || undefined,
        image: product.thumbnail,
        quantity,
        discountPercentage: product.discountPercentage || 0,
        slug: product.slug
      })
    }
    logger.debug('[Cart] add item:', { userId: getUserId(req), items: cart.items.length })
    cart.updatedAt = new Date()
    await cart.save()
    res.json(cart)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/cart/update
exports.update = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })
    const { productId, quantity } = req.body
    if (!productId || typeof quantity !== 'number' || quantity < 1) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' })

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chưa có giỏ hàng' })

    const idx = cart.items.findIndex(i => i.productId.equals(productId))
    if (idx < 0) return res.status(404).json({ error: 'Sản phẩm không có trong giỏ' })

    cart.items[idx].quantity = quantity
    cart.updatedAt = new Date()
    await cart.save()
    res.json(cart)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/cart/remove
exports.remove = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })
    const { productId } = req.body
    if (!productId) return res.status(400).json({ error: 'Thiếu productId' })

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chưa có giỏ hàng' })

    cart.items = cart.items.filter(i => !i.productId.equals(productId))
    cart.updatedAt = new Date()
    await cart.save()
    res.json(cart)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/cart/clear
exports.clear = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })
    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chưa có giỏ hàng' })

    cart.items = []
    cart.updatedAt = new Date()
    await cart.save()
    res.json(cart)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/cart/remove-many
exports.removeMany = async (req, res) => {
  try {
    const userId = getUserId(req)
    const { productIds } = req.body
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' })
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Thiếu danh sách sản phẩm' })
    }
    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chưa có giỏ hàng' })

    cart.items = cart.items.filter(item => !productIds.includes(item.productId.toString()))
    cart.updatedAt = new Date()
    await cart.save()
    res.json({ success: true, cart })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
