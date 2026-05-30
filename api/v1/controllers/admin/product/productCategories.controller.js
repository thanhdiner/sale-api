const logger = require('../../../../../config/logger')
const productCategoriesService = require('../../../services/admin/product/productCategories.service')

//# Get /api/v1/admin/product-categories
module.exports.index = async (req, res, next) => {
  try {
    const result = await productCategoriesService.listProductCategories({
      ...req.query,
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# Get /api/v1/admin/product-categories/tree
module.exports.getProductCategoryTree = async (_req, res, next) => {
  try {
    const result = await productCategoriesService.getProductCategoryTree()
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

//# Patch /api/v1/admin/product-categories/delete/:id
module.exports.delete = async (req, res, next) => {
  try {
    const result = await productCategoriesService.deleteProductCategory(req.params.id, req.user?.userId)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# Patch /api/v1/admin/product-categories/deleteMany
module.exports.deleteMany = async (req, res, next) => {
  try {
    const result = await productCategoriesService.deleteManyProductCategories(
      req.body.ids,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# Patch /api/v1/admin/product-categories/changeStatus/:id
module.exports.changeStatus = async (req, res, next) => {
  try {
    const result = await productCategoriesService.changeProductCategoryStatus(
      req.params.id,
      req.body.status,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/product-categories/changeStatusMany
module.exports.changeStatusMany = async (req, res, next) => {
  try {
    const result = await productCategoriesService.changeProductCategoryStatusMany(
      req.body.ids,
      req.body.status,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/product-categories/change-position-many
module.exports.changePositionMany = async (req, res, next) => {
  try {
    const result = await productCategoriesService.changeProductCategoryPositionMany(
      req.body.data,
      req.user?.userId
    )
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# Post /api/v1/admin/product-categories/create
module.exports.create = async (req, res, next) => {
  try {
    const result = await productCategoriesService.createProductCategory(req.body, req.user?.userId)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# Get /api/v1/product-categories/:id
module.exports.detail = async (req, res, next) => {
  try {
    const result = await productCategoriesService.getProductCategoryDetail(req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/product-categories/edit/:id
module.exports.edit = async (req, res, next) => {
  try {
    const result = await productCategoriesService.editProductCategory(
      req.params.id,
      req.body,
      req.user?.userId
    )
    return res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










