const logger = require('../../../../../config/logger')
const productCategoriesService = require('../../../services/admin/product/productCategories.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  const payload = { error: error.message }
  if (error.details) {
    Object.assign(payload, error.details)
  }

  res.status(error.statusCode).json(payload)
  return true
}

//# Get /api/v1/admin/product-categories
module.exports.index = async (req, res) => {
  try {
    const result = await productCategoriesService.listProductCategories({
      ...req.query,
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    logger.error('[Admin] Error getting product categories:', err)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# Get /api/v1/admin/product-categories/tree
module.exports.getProductCategoryTree = async (_req, res) => {
  try {
    const result = await productCategoriesService.getProductCategoryTree()
    res.json(result)
  } catch (error) {
    logger.error('[Admin] Error getting product category tree:', error)
    res.status(500).json({ error: 'Server error', status: 500 })
  }
}

//# Patch /api/v1/admin/product-categories/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await productCategoriesService.deleteProductCategory(req.params.id, req.user?.userId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting product category:', err)
    res.status(500).json({ error: 'Failed to delete product category', status: 400 })
  }
}

//# Patch /api/v1/admin/product-categories/deleteMany
module.exports.deleteMany = async (req, res) => {
  try {
    const result = await productCategoriesService.deleteManyProductCategories(
      req.body.ids,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting many product categories:', err)
    res.status(500).json({ error: 'Failed to delete product categories', status: 400 })
  }
}

//# Patch /api/v1/admin/product-categories/changeStatus/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const result = await productCategoriesService.changeProductCategoryStatus(
      req.params.id,
      req.body.status,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error changing product category status:', err)
    res.status(500).json({ error: 'Failed to change product category status', status: 400 })
  }
}

//# PATCH /api/v1/admin/product-categories/changeStatusMany
module.exports.changeStatusMany = async (req, res) => {
  try {
    const result = await productCategoriesService.changeProductCategoryStatusMany(
      req.body.ids,
      req.body.status,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error changing many product category statuses:', err)
    res.status(500).json({ error: 'Failed to change product category statuses', status: 400 })
  }
}

//# PATCH /api/v1/admin/product-categories/change-position-many
module.exports.changePositionMany = async (req, res) => {
  try {
    const result = await productCategoriesService.changeProductCategoryPositionMany(
      req.body.data,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error changing product category positions:', err)
    return res.status(500).json({ error: 'Failed to change product category positions', status: 400 })
  }
}

//# Post /api/v1/admin/product-categories/create
module.exports.create = async (req, res) => {
  try {
    const result = await productCategoriesService.createProductCategory(req.body, req.user?.userId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating product category:', err)
    res.status(500).json({ error: 'Failed to create product category', status: 400 })
  }
}

//# Get /api/v1/product-categories/:id
module.exports.detail = async (req, res) => {
  try {
    const result = await productCategoriesService.getProductCategoryDetail(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error getting product category detail:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

//# PATCH /api/v1/admin/product-categories/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const result = await productCategoriesService.editProductCategory(
      req.params.id,
      req.body,
      req.user?.userId
    )
    return res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating product category:', err)
    return res.status(500).json({ error: 'Failed to update product category', status: 400 })
  }
}










