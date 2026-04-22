const Product = require('../../models/products.model')
require('../../models/adminAccount.model')
const paginationHelper = require('../../helpers/pagination')
const { setDefaultPosition, validateProductCategory } = require('../../helpers/productHelper')
const parseIntegerFields = require('../../utils/parseIntegerFields')
const handleSlug = require('../../utils/handleSlug')
const mongoose = require('mongoose')
const removeAccents = require('remove-accents')
const logger = require('../../../../config/logger')

const getUploadedFileUrl = file => {
  if (!file) return ''

  return file.path || file.secure_url || file.url || file.filename || ''
}

const normalizeUploadedImages = files => {
  if (!Array.isArray(files)) return []

  return files.map(file => getUploadedFileUrl(file)).filter(Boolean)
}

const parseStringArray = value => {
  if (value == null || value === '') return []

  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.map(item => String(item).trim()).filter(Boolean)
        : []
    } catch {
      return value.trim() ? [value.trim()] : []
    }
  }

  return []
}

const setTitleNoAccent = body => {
  if (typeof body.title === 'string' && body.title.trim()) {
    body.titleNoAccent = removeAccents(body.title.trim())
  }
}

const summarizeUploadFile = file => {
  if (!file) return null

  return {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  }
}

const summarizeUploadFiles = files => {
  if (!files || typeof files !== 'object') return {}

  return Object.fromEntries(
    Object.entries(files).map(([field, items]) => [
      field,
      Array.isArray(items) ? items.map(summarizeUploadFile) : summarizeUploadFile(items)
    ])
  )
}

const summarizeProductBody = body => ({
  title: body.title,
  titleNoAccent: body.titleNoAccent,
  slug: body.slug,
  productCategory: body.productCategory,
  price: body.price,
  costPrice: body.costPrice,
  discountPercentage: body.discountPercentage,
  stock: body.stock,
  status: body.status,
  position: body.position,
  isTopDeal: body.isTopDeal,
  isFeatured: body.isFeatured,
  deliveryEstimateDays: body.deliveryEstimateDays,
  thumbnail: body.thumbnail,
  imagesCount: Array.isArray(body.images) ? body.images.length : 0,
  featuresCount: Array.isArray(body.features) ? body.features.length : body.features ? 1 : 0,
  descriptionLength: body.description?.length || 0,
  contentLength: body.content?.length || 0,
  timeStart: body.timeStart,
  timeFinish: body.timeFinish
})

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

    const initPagination = {
      currentPage: 1,
      limitItems: 10
    }

    const countProducts = await Product.countDocuments(find)
    const objectPagination = paginationHelper(initPagination, req.query, countProducts)

    let sort = {}
    if (sortField && sortOrder) sort[sortField] = sortOrder === 'descend' ? -1 : 1
    else sort.position = -1

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
    logger.error('[Admin] Error fetching products:', err)
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

    res.json({
      code: 200,
      message: 'Get Product successfully!',
      product
    })
  } catch (err) {
    logger.error('[Admin] Error fetching product:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

//# Post /api/v1/admin/products/create
module.exports.create = async (req, res) => {
  try {
    logger.debug('[Admin][CreateProduct] ── START ──')
    logger.debug('[Admin][CreateProduct] req.body', { body: summarizeProductBody(req.body) })
    logger.debug('[Admin][CreateProduct] req.file', { file: summarizeUploadFile(req.file) })
    logger.debug('[Admin][CreateProduct] req.files', { files: summarizeUploadFiles(req.files) })
    logger.debug('[Admin][CreateProduct] req.user', { user: req.user })

    parseIntegerFields(req.body, ['price', 'costPrice', 'discountPercentage', 'stock', 'deliveryEstimateDays'])

    logger.debug('[Admin][CreateProduct] After parseIntegerFields', {
      price: req.body.price,
      costPrice: req.body.costPrice,
      stock: req.body.stock
    })

    await setDefaultPosition(req.body)

    logger.debug('[Admin][CreateProduct] Position', { position: req.body.position })

    const category = await validateProductCategory(req.body.productCategory)

    logger.debug('[Admin][CreateProduct] Category validation', {
      requestedCategory: req.body.productCategory,
      categoryId: category ? String(category._id) : null
    })

    if (!category) {
      return res.status(400).json({ error: 'Invalid or deleted product category!' })
    }

    const { slug, error, suggestedSlug } = await handleSlug({
      Model: Product,
      slugInput: req.body.slug,
      title: req.body.title
    })

    logger.debug('[Admin][CreateProduct] Slug result', { slug, error, suggestedSlug })

    if (error) {
      return res.status(400).json({ error, suggestedSlug })
    }

    req.body.slug = slug
    setTitleNoAccent(req.body)
    req.body.isTopDeal = req.body.isTopDeal === 'true'
    req.body.isFeatured = req.body.isFeatured === 'true'
    req.body.createdBy = { by: req.user?.userId, at: Date.now() }

    if (req.body.features && !Array.isArray(req.body.features)) {
      req.body.features = [req.body.features]
    }

    const thumbnailFile = req.files?.thumbnail?.[0] || req.file

    const thumbnailUrl = getUploadedFileUrl(thumbnailFile)
    const uploadedImageUrls = parseStringArray(req.body.images)

    if (thumbnailUrl) {
      req.body.thumbnail = thumbnailUrl
    }

    if (uploadedImageUrls.length > 0) {
      req.body.images = uploadedImageUrls
    }

    logger.debug('[Admin][CreateProduct] Upload result', {
      thumbnail: req.body.thumbnail,
      images: req.body.images
    })

    logger.debug('[Admin][CreateProduct] Final body before save', {
      body: summarizeProductBody(req.body)
    })

    const product = new Product(req.body)
    const data = await product.save()

    logger.debug('[Admin][CreateProduct] ✅ Saved product _id:', data._id)

    res.json({
      code: 200,
      message: 'Product created successfully!',
      data
    })
  } catch (err) {
    logger.error('[Admin][CreateProduct] ❌ Error:', err.message)
    logger.error('[Admin][CreateProduct] ❌ Stack:', err.stack)

    logger.error('[Admin][CreateProduct] Error detail', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      errors: err?.errors
        ? Object.fromEntries(Object.entries(err.errors).map(([field, value]) => [field, value.message]))
        : undefined
    })
    logger.error(err?.stack || '[Admin][CreateProduct] Stack unavailable')

    res.status(500).json({
      error: 'Failed to create product',
      status: 500
    })
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
    logger.error('[Admin] Error deleting product:', err)
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
    logger.error('[Admin] Error changing product status:', err)
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
      message: `Deleted ${ids.length} products successfully!`
    })
  } catch (err) {
    logger.error('[Admin] Error deleting many products:', err)
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
      message: `Changed status of ${ids.length} products to "${status}"`,
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

    const updatedProducts = await Product.find({ _id: { $in: data.map(item => item._id) } })
      .populate('updateBy.by', 'fullName avatarUrl')
      .select('_id position updateBy updatedAt')

    res.json({
      code: 200,
      message: `Updated position for ${data.length} products`,
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

    logger.debug('[Admin][EditProduct] ── START ──')
    logger.debug('[Admin][EditProduct] req.body', { body: summarizeProductBody(req.body) })
    logger.debug('[Admin][EditProduct] req.file', { file: summarizeUploadFile(req.file) })
    logger.debug('[Admin][EditProduct] req.files', { files: summarizeUploadFiles(req.files) })
    logger.debug('[Admin][EditProduct] req.user', { user: req.user })

    parseIntegerFields(req.body, ['price', 'costPrice', 'discountPercentage', 'stock', 'position', 'deliveryEstimateDays'])

    logger.debug('[Admin][EditProduct] After parseIntegerFields', {
      price: req.body.price,
      costPrice: req.body.costPrice,
      stock: req.body.stock,
      position: req.body.position,
      deliveryEstimateDays: req.body.deliveryEstimateDays
    })

    const category = await validateProductCategory(req.body.productCategory)

    logger.debug('[Admin][EditProduct] Category validation', {
      requestedCategory: req.body.productCategory,
      categoryId: category ? String(category._id) : null
    })

    if (!category) {
      return res.status(400).json({ error: 'Invalid or deleted product category!' })
    }

    const { slug, error, suggestedSlug } = await handleSlug({
      Model: Product,
      slugInput: req.body.slug,
      title: req.body.title,
      currentId: productId
    })

    logger.debug('[Admin][EditProduct] Slug result', { slug, error, suggestedSlug })

    if ('features' in req.body) {
      const raw = req.body.features
      let normalized = []

      if (raw === '' || raw == null) {
        normalized = []
      } else if (Array.isArray(raw)) {
        normalized = raw
          .map(String)
          .map(item => item.trim())
          .filter(Boolean)
      } else {
        normalized = [String(raw)].map(item => item.trim()).filter(Boolean)
      }

      req.body.features = normalized

      logger.debug('[Admin][EditProduct] Features normalized', {
        count: normalized.length,
        features: normalized
      })
    }

    if (error) {
      return res.status(400).json({ error, suggestedSlug })
    }

    req.body.slug = slug
    setTitleNoAccent(req.body)
    req.body.isTopDeal = req.body.isTopDeal === 'true'
    req.body.isFeatured = req.body.isFeatured === 'true'

    const hasExistingImagesField = Object.prototype.hasOwnProperty.call(req.body, 'existingImages')
    const existingImages = parseStringArray(req.body.existingImages)
    const thumbnailFile = req.files?.thumbnail?.[0] || req.file

    const thumbnailUrl = getUploadedFileUrl(thumbnailFile)
    const uploadedImageUrls = parseStringArray(req.body.images)

    if (thumbnailUrl) {
      req.body.thumbnail = thumbnailUrl
    }

    if (hasExistingImagesField || uploadedImageUrls.length > 0) {
      req.body.images = [...existingImages, ...uploadedImageUrls]
    }

    delete req.body.existingImages
    delete req.body.oldImages
    delete req.body.deleteImages

    logger.debug('[Admin][EditProduct] Upload result', {
      thumbnail: req.body.thumbnail,
      images: req.body.images
    })

    const updateFields = {
      ...req.body,
      $push: {
        updateBy: {
          by: req.user?.userId,
          at: new Date()
        }
      }
    }

    logger.debug('[Admin][EditProduct] Final body before update', {
      productId,
      body: summarizeProductBody(req.body),
      updateByUserId: req.user?.userId
    })

    const updatedProduct = await Product.findByIdAndUpdate(productId, updateFields, {
      new: true,
      runValidators: true
    }).populate('updateBy.by', 'fullName avatarUrl')

    logger.debug('[Admin][EditProduct] Updated product', {
      productId: updatedProduct ? String(updatedProduct._id) : null,
      found: !!updatedProduct
    })

    return res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct
    })
  } catch (err) {
    logger.error('[Admin] Error updating product:', err)
    logger.error('[Admin][EditProduct] Error detail', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      errors: err?.errors
        ? Object.fromEntries(Object.entries(err.errors).map(([field, value]) => [field, value.message]))
        : undefined
    })
    logger.error(err?.stack || '[Admin][EditProduct] Stack unavailable')
    return res.status(500).json({ error: 'Failed to update product', status: 400 })
  }
}
