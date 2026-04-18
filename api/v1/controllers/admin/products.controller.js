const Product = require('../../models/products.model')
const paginationHelper = require('../../helpers/pagination')
const { setDefaultPosition, validateProductCategory } = require('../../helpers/productHelper')
const parseIntegerFields = require('../../utils/parseIntegerFields')
const handleSlug = require('../../utils/handleSlug')
const mongoose = require('mongoose')
const logger = require('../../../../config/logger')

//# Get /api/v1/admin/products
module.exports.index = async (req, res) => {
  try {
    let find = {
      deleted: false
    }
    const { status, productName, price, stock, discountPercentage, position, sortField, sortOrder, product_category } = req.query

    if (status && status !== 'all') find.status = status
    if (productName) find.title = { $regex: productName, $options: 'i' }
    if (price) find.price = +price
    if (stock) find.stock = +stock
    if (discountPercentage) find.discountPercentage = +discountPercentage
    if (position) find.position = +position
    if (mongoose.Types.ObjectId.isValid(product_category)) find.productCategory = new mongoose.Types.ObjectId(product_category)
    //@ pagination
    let initPagination = {
      currentPage: 1,
      limitItems: 10
    }

    const countProducts = await Product.countDocuments(find)

    let objectPagination = paginationHelper(initPagination, req.query, countProducts)

    //@ sorting
    let sort = {}
    if (sortField && sortOrder) sort[sortField] = sortOrder === 'descend' ? -1 : 1
    else sort['position'] = -1

    const products = await Product.find(find)
      .populate('productCategory', 'title')
      .populate('createdBy.by', 'fullName avatarUrl')
      .populate('updateBy.by', 'fullName avatarUrl')
      .sort(sort)
      .limit(objectPagination.limitItems)
      .skip(objectPagination.skip)

    res.json({
      products,
      total: countProducts,
      currentPage: objectPagination.currentPage,
      totalPage: objectPagination.totalPage,
      limitItems: objectPagination.limitItems
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# Get /api/v1/products/:id
module.exports.detail = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy.by', 'fullName avatarUrl')
      .populate('updateBy.by', 'fullName avatarUrl')
    if (!product) return res.status(404).json({ message: 'Product not found' })
    res.json({ code: 200, message: ' Get Product Category successfully!', product })
  } catch (err) {
    logger.error('[Admin] Error fetching product:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

//# Post /api/v1/admin/products/create
module.exports.create = async (req, res) => {
  try {
    logger.debug('[Admin][CreateProduct] ── START ──')
    logger.debug('[Admin][CreateProduct] req.body:', JSON.stringify(req.body, null, 2))
    logger.debug('[Admin][CreateProduct] req.file:', req.file ? { name: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : 'NO FILE')
    logger.debug('[Admin][CreateProduct] req.user:', req.user)

    parseIntegerFields(req.body, ['price', 'costPrice', 'discountPercentage', 'stock', 'deliveryEstimateDays'])
    logger.debug('[Admin][CreateProduct] After parseIntegerFields:', { price: req.body.price, costPrice: req.body.costPrice, stock: req.body.stock })

    await setDefaultPosition(req.body)
    logger.debug('[Admin][CreateProduct] Position:', req.body.position)

    const category = await validateProductCategory(req.body.productCategory)
    logger.debug('[Admin][CreateProduct] Category validation:', category ? category._id : 'INVALID')
    if (!category) return res.status(400).json({ error: 'Invalid or deleted product category!' })

    const { slug, error, suggestedSlug } = await handleSlug({ Model: Product, slugInput: req.body.slug, title: req.body.title })
    logger.debug('[Admin][CreateProduct] Slug result:', { slug, error, suggestedSlug })
    if (error) return res.status(400).json({ error, suggestedSlug })
    req.body.slug = slug
    req.body.isTopDeal = req.body.isTopDeal === 'true'
    req.body.isFeatured = req.body.isFeatured === 'true'
    req.body.createdBy = { by: req.user?.userId, at: Date.now() }
    if (req.body.features && !Array.isArray(req.body.features)) {
      req.body.features = [req.body.features]
    }

    logger.debug('[Admin][CreateProduct] Final body before save:', JSON.stringify(req.body, null, 2))

    const product = new Product(req.body)
    const data = await product.save()

    logger.debug('[Admin][CreateProduct] ✅ Saved product _id:', data._id)

    res.json({
      code: 200,
      message: ' Product created successfully!',
      data: data
    })
  } catch (err) {
    logger.error('[Admin][CreateProduct] ❌ Error:', err.message)
    logger.error('[Admin][CreateProduct] ❌ Stack:', err.stack)
    res.status(500).json({ error: 'Failed to create product', status: 400 })
  }
}

//# Patch /api/v1/admin/products/delete/:id
module.exports.delete = async (req, res) => {
  try {
    await Product.updateOne(
      { _id: req.params.id },
      {
        deleted: true,
        deletedBy: {
          by: req.user?.userId,
          at: new Date()
        }
      }
    )
    res.json({
      code: 200,
      message: 'Product deleted successfully!'
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product', status: 400 })
  }
}

//# Patch /api/v1/admin/products/changeStatus/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const newStatus = req.body.status === 'active' ? 'inactive' : 'active'
    await Product.updateOne(
      { _id: req.params.id },
      {
        status: newStatus,
        $push: {
          updateBy: {
            by: req.user?.userId,
            at: new Date()
          }
        }
      }
    )
    const updatedProduct = await Product.findById(req.params.id).populate('updateBy.by', 'fullName avatarUrl').select('updateBy')

    res.json({
      code: 200,
      message: 'Product status changed successfully!',
      status: newStatus,
      product: updatedProduct
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to change product status', status: 400 })
  }
}

//# Patch /api/v1/admin/products/deleteMany
module.exports.deleteMany = async (req, res) => {
  try {
    const ids = req.body.ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request data', status: 400 })
    }

    await Product.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          deleted: true,
          deletedBy: {
            by: req.user?.userId,
            at: new Date()
          }
        }
      }
    )

    res.json({
      code: 200,
      message: `🗑️ Deleted ${ids.length} products successfully!`
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete products', status: 400 })
  }
}

//# PATCH /api/v1/admin/products/changeStatusMany
module.exports.changeStatusMany = async (req, res) => {
  try {
    const { ids, status } = req.body

    if (!Array.isArray(ids) || ids.length === 0 || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid request data', status: 400 })
    }

    const updateFields = {
      status,
      $push: {
        updateBy: {
          by: req.user?.userId,
          at: new Date()
        }
      },
      updatedAt: new Date()
    }
    await Product.updateMany({ _id: { $in: ids } }, updateFields)

    const updatedProducts = await Product.find({ _id: { $in: ids } })
      .populate('updateBy.by', 'fullName avatarUrl')
      .select('_id status updateBy updatedAt')

    res.json({
      code: 200,
      message: `✅ Changed status of ${ids.length} products to "${status}"`,
      products: updatedProducts
    })
  } catch (err) {
    logger.error('[Admin] Error changing product statuses:', err)
    res.status(500).json({ error: 'Failed to change product statuses', status: 400 })
  }
}

//# PATCH /api/v1/admin/products/change-position-many
module.exports.changePositionMany = async (req, res) => {
  try {
    const { data } = req.body
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid data' })
    }

    const bulkOps = data.map(({ _id, position }) => ({
      updateOne: {
        filter: { _id },
        update: {
          $set: { position },
          $push: {
            updateBy: {
              by: req.user?.userId,
              at: new Date()
            }
          },
          updatedAt: new Date()
        }
      }
    }))

    await Product.bulkWrite(bulkOps)

    const updatedProducts = await Product.find({ _id: { $in: data.map(i => i._id) } })
      .populate('updateBy.by', 'fullName avatarUrl')
      .select('_id position updateBy updatedAt')

    res.json({
      code: 200,
      message: `✅ Updated position for ${data.length} products`,
      products: updatedProducts
    })
  } catch (err) {
    logger.error('[Admin] Error changing product positions:', err)
    return res.status(500).json({ error: 'Failed to change product positions', status: 400 })
  }
}

//# PATCH /api/v1/admin/products/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const productId = req.params.id
    parseIntegerFields(req.body, ['price', 'costPrice', 'discountPercentage', 'stock', 'position'])

    const category = await validateProductCategory(req.body.productCategory)
    if (!category) return res.status(400).json({ error: 'Invalid or deleted product category!' })

    const { slug, error, suggestedSlug } = await handleSlug({
      Model: Product,
      slugInput: req.body.slug,
      title: req.body.title,
      currentId: productId
    })

    if ('features' in req.body) {
      const raw = req.body.features
      let normalized = []

      if (raw === '' || raw == null) {
        normalized = []
      } else if (Array.isArray(raw)) {
        normalized = raw
          .map(String)
          .map(s => s.trim())
          .filter(Boolean)
      } else {
        normalized = [String(raw)].map(s => s.trim()).filter(Boolean)
      }

      req.body.features = normalized
    }

    if (error) return res.status(400).json({ error, suggestedSlug })
    req.body.slug = slug
    req.body.isTopDeal = req.body.isTopDeal === 'true'
    req.body.isFeatured = req.body.isFeatured === 'true'

    const updateFields = {
      ...req.body,
      $push: {
        updateBy: {
          by: req.user?.userId,
          at: new Date()
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId, updateFields, {
      new: true,
      runValidators: true
    }).populate('updateBy.by', 'fullName avatarUrl')
    return res.status(200).json({
      message: '✅ Product updated successfully',
      product: updatedProduct
    })
  } catch (err) {
    logger.error('[Admin] Error updating product:', err)
    return res.status(500).json({ error: 'Failed to update product', status: 400 })
  }
}
