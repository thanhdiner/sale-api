const Cart = require('../../models/cart.model')
const Product = require('../../models/products.model')
const logger = require('../../../../config/logger')

const MAX_CART_UNIQUE_ITEMS = 50
const CART_UNIQUE_LIMIT_MESSAGE = `Gio hang chi chua toi da ${MAX_CART_UNIQUE_ITEMS} san pham khac nhau`

const getUserId = req => req.user?.userId
const isSellableProduct = product => product && product.deleted !== true && product.status === 'active'

//# GET /api/v1/cart
exports.index = async (req, res) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Chua dang nhap' })

    let cart = await Cart.findOne({ userId })
    if (!cart) cart = await Cart.create({ userId, items: [] })

    const productIds = cart.items.map(item => item.productId)
    const products = await Product.find({ _id: { $in: productIds } })

    const productMap = {}
    products.forEach(product => {
      productMap[product._id.toString()] = product
    })

    const itemsWithStock = cart.items.map(item => {
      const product = productMap[item.productId.toString()]
      const currentPrice =
        item.isFlashSale && item.salePrice !== undefined
          ? item.salePrice
          : product
            ? product.price * (1 - (product.discountPercentage || 0) / 100)
            : item.price

      return {
        ...item.toObject(),
        stock: product ? product.stock : 0,
        name: product ? product.title : item.name,
        image: product ? product.thumbnail : item.image,
        price: currentPrice,
        originalPrice: product ? product.price : item.price,
        inStock: product ? product.stock > 0 : false,
        discountPercentage: product ? product.discountPercentage : item.discountPercentage,
        slug: product ? product.slug : item.slug
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
    if (!userId) return res.status(401).json({ error: 'Chua dang nhap' })

    const { productId, quantity = 1, salePrice, discountPercent, isFlashSale, flashSaleId } = req.body
    if (!productId) return res.status(400).json({ error: 'Thieu productId' })

    const product = await Product.findById(productId)
    if (!isSellableProduct(product)) return res.status(404).json({ error: 'Khong tim thay san pham' })
    if (product.stock <= 0) {
      return res.status(400).json({ error: 'San pham hien da het hang', stock: product.stock })
    }

    let cart = await Cart.findOne({ userId })
    if (!cart) cart = await Cart.create({ userId, items: [] })

    const index = cart.items.findIndex(item => item.productId.equals(productId))
    if (index >= 0) {
      const nextQuantity = cart.items[index].quantity + quantity
      if (nextQuantity > product.stock) {
        return res.status(400).json({
          error: `So luong vuot qua ton kho hien co (${product.stock})`,
          stock: product.stock
        })
      }

      cart.items[index].quantity = nextQuantity
      if (isFlashSale && salePrice !== undefined) {
        cart.items[index].salePrice = salePrice
        cart.items[index].isFlashSale = true
        cart.items[index].flashSaleId = flashSaleId
        cart.items[index].discountPercentage = discountPercent
      }

      const item = cart.items[index]
      cart.items.splice(index, 1)
      cart.items.unshift(item)
    } else {
      if (cart.items.length >= MAX_CART_UNIQUE_ITEMS) {
        return res.status(400).json({
          error: CART_UNIQUE_LIMIT_MESSAGE,
          maxUniqueItems: MAX_CART_UNIQUE_ITEMS
        })
      }

      if (quantity > product.stock) {
        return res.status(400).json({
          error: `So luong vuot qua ton kho hien co (${product.stock})`,
          stock: product.stock
        })
      }

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

    logger.debug('[Cart] add item:', { userId, items: cart.items.length })
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
    if (!userId) return res.status(401).json({ error: 'Chua dang nhap' })

    const { productId, quantity } = req.body
    if (!productId || typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({ error: 'Du lieu khong hop le' })
    }

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chua co gio hang' })

    const index = cart.items.findIndex(item => item.productId.equals(productId))
    if (index < 0) return res.status(404).json({ error: 'San pham khong co trong gio' })

    const product = await Product.findById(productId)
    if (!isSellableProduct(product)) return res.status(404).json({ error: 'Khong tim thay san pham' })
    if (quantity > product.stock) {
      return res.status(400).json({
        error: `So luong vuot qua ton kho hien co (${product.stock})`,
        stock: product.stock
      })
    }

    cart.items[index].quantity = quantity
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
    if (!userId) return res.status(401).json({ error: 'Chua dang nhap' })

    const { productId } = req.body
    if (!productId) return res.status(400).json({ error: 'Thieu productId' })

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chua co gio hang' })

    cart.items = cart.items.filter(item => !item.productId.equals(productId))
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
    if (!userId) return res.status(401).json({ error: 'Chua dang nhap' })

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chua co gio hang' })

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

    if (!userId) return res.status(401).json({ error: 'Chua dang nhap' })
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Thieu danh sach san pham' })
    }

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ error: 'Chua co gio hang' })

    cart.items = cart.items.filter(item => !productIds.includes(item.productId.toString()))
    cart.updatedAt = new Date()
    await cart.save()
    res.json({ success: true, cart })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
