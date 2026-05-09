const mongoose = require('mongoose')
const paginationHelper = require('../../../helpers/pagination')
const parseIntegerFields = require('../../../utils/parseIntegerFields')
const {
  buildTree,
  validateParentId,
  setDefaultPosition
} = require('../../../helpers/product-categoryHelper')
const handleSlug = require('../../../utils/handleSlug')
const AppError = require('../../../utils/AppError')
const productCategoryRepository = require('../../../repositories/product/productCategory.repository')

function ensureValidObjectId(id, message = 'Product Category not found') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeWriteError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.code === 11000) {
    return new AppError(error.message || fallbackMessage, 400)
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(error.message || fallbackMessage, 400)
  }

  return error
}

function buildTextSearch(value) {
  const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { $regex: escapedValue, $options: 'i' }
}

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

async function listProductCategories(params = {}) {
  const find = {
    deleted: false
  }

  const { status, categoryName, position, sortField, sortOrder, language } = params
  const normalizedLanguage = normalizeLanguage(language)

  if (status && status !== 'all') find.status = status
  if (categoryName) {
    const textSearch = buildTextSearch(categoryName)
    find.$or = [
      { title: textSearch },
      { 'translations.en.title': textSearch }
    ]
  }
  if (position) find.position = +position

  const initPagination = {
    currentPage: 1,
    limitItems: 10
  }

  const countProductCategories = await productCategoryRepository.countByQuery(find)
  const objectPagination = paginationHelper(initPagination, params, countProductCategories)

  const sort = {}
  if (sortField && sortOrder) {
    const sortDirection = sortOrder === 'descend' ? -1 : 1
    const localizedSortField = sortField === 'title' && normalizedLanguage === 'en' ? 'translations.en.title' : sortField
    sort[localizedSortField] = sortDirection
    if (localizedSortField !== sortField) sort[sortField] = sortDirection
  } else sort.position = -1

  const productCategories = await productCategoryRepository.findAll(find, {
    sort,
    limit: objectPagination.limitItems,
    skip: objectPagination.skip,
    populate: [
      { path: 'parent_id', select: 'title translations' },
      { path: 'createdBy.by', select: 'fullName avatarUrl' },
      { path: 'updateBy.by', select: 'fullName avatarUrl' }
    ]
  })

  return {
    productCategories,
    total: countProductCategories,
    currentPage: objectPagination.currentPage,
    totalPage: objectPagination.totalPage,
    limitItems: objectPagination.limitItems
  }
}

async function getProductCategoryTree() {
  const categories = await productCategoryRepository.findAll({ deleted: false })
  return buildTree(categories)
}

async function deleteProductCategory(id, userId) {
  ensureValidObjectId(id)

  await productCategoryRepository.updateOne(
    { _id: id },
    {
      deleted: true,
      deletedBy: {
        by: userId,
        at: new Date()
      }
    }
  )

  return {
    code: 200,
    message: 'Product Category deleted successfully!'
  }
}

async function deleteManyProductCategories(ids = [], userId) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Invalid request data', 400)
  }

  ids.forEach(id => ensureValidObjectId(id))

  await productCategoryRepository.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        deleted: true,
        deletedBy: {
          by: userId,
          at: new Date()
        }
      }
    }
  )

  return {
    code: 200,
    message: `Deleted ${ids.length} product categories successfully!`
  }
}

async function changeProductCategoryStatus(id, currentStatus, userId) {
  ensureValidObjectId(id)

  const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

  await productCategoryRepository.updateOne(
    { _id: id },
    {
      status: newStatus,
      $push: {
        updateBy: {
          by: userId,
          at: new Date()
        }
      }
    }
  )

  const updatedProductCategory = await productCategoryRepository.findById(id, {
    select: 'updateBy',
    populate: { path: 'updateBy.by', select: 'fullName avatarUrl' }
  })

  return {
    code: 200,
    message: 'Product Category status changed successfully!',
    status: newStatus,
    productCategory: updatedProductCategory
  }
}

async function changeProductCategoryStatusMany(ids = [], status, userId) {
  if (!Array.isArray(ids) || ids.length === 0 || !['active', 'inactive'].includes(status)) {
    throw new AppError('Invalid request data', 400)
  }

  ids.forEach(id => ensureValidObjectId(id))

  const updateFields = {
    status,
    $push: {
      updateBy: {
        by: userId,
        at: new Date()
      }
    },
    updatedAt: new Date()
  }

  await productCategoryRepository.updateMany({ _id: { $in: ids } }, updateFields)

  const updatedProductCategories = await productCategoryRepository.findAll({ _id: { $in: ids } }, {
    select: '_id status updateBy updatedAt',
    populate: { path: 'updateBy.by', select: 'fullName avatarUrl' }
  })

  return {
    code: 200,
    message: `Changed status of ${ids.length} product categories to "${status}"`,
    status,
    productCategories: updatedProductCategories
  }
}

async function changeProductCategoryPositionMany(data = [], userId) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new AppError('Invalid data', 400)
  }

  const bulkOps = data.map(({ _id, position }) => {
    ensureValidObjectId(_id)

    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: { position },
          $push: {
            updateBy: {
              by: userId,
              at: new Date()
            }
          },
          updatedAt: new Date()
        }
      }
    }
  })

  await productCategoryRepository.bulkWrite(bulkOps)

  const updatedProductCategories = await productCategoryRepository.findAll({ _id: { $in: data.map(item => item._id) } }, {
    select: '_id position updateBy updatedAt',
    populate: { path: 'updateBy.by', select: 'fullName avatarUrl' }
  })

  return {
    code: 200,
    message: `Updated position for ${data.length} product categories`,
    productCategories: updatedProductCategories
  }
}

async function createProductCategory(payload = {}, userId) {
  const body = { ...payload }

  await setDefaultPosition(body)

  const check = await validateParentId(body.parent_id)
  if (!check.ok) {
    throw new AppError(check.error, 400)
  }

  const { slug, error, suggestedSlug } = await handleSlug({
    source: productCategoryRepository,
    slugInput: body.slug,
    title: body.title
  })
  if (error) {
    throw new AppError(error, 400, { suggestedSlug })
  }

  body.slug = slug
  if (body.parent_id === '' || body.parent_id === undefined) body.parent_id = null
  body.createdBy = { by: userId, at: Date.now() }

  try {
    const data = await productCategoryRepository.create(body)

    return {
      code: 200,
      message: 'Product Category created successfully!',
      data
    }
  } catch (err) {
    throw normalizeWriteError(err, 'Failed to create product category')
  }
}

async function getProductCategoryDetail(id) {
  ensureValidObjectId(id)

  const productCategory = await productCategoryRepository.findById(id, {
    populate: { path: 'parent_id', select: 'title translations' }
  })
  if (!productCategory) {
    throw new AppError('Product Category not found', 404)
  }

  return {
    code: 200,
    message: 'Get Product Category successfully!',
    productCategory,
    parentCategory: productCategory?.parent_id?.title
  }
}

async function editProductCategory(id, payload = {}, userId) {
  ensureValidObjectId(id)

  const body = { ...payload }
  parseIntegerFields(body, ['position'])

  const check = await validateParentId(body.parent_id, id)
  if (!check.ok) {
    throw new AppError(check.error, 400)
  }

  if (body.parent_id === '' || body.parent_id === undefined) body.parent_id = null

  const { slug, error, suggestedSlug } = await handleSlug({
    source: productCategoryRepository,
    slugInput: body.slug,
    title: body.title,
    currentId: id
  })
  if (error) {
    throw new AppError(error, 400, { suggestedSlug })
  }

  body.slug = slug

  const updateFields = {
    ...body,
    $push: {
      updateBy: {
        by: userId,
        at: new Date()
      }
    }
  }

  try {
    const updatedProductCategory = await productCategoryRepository.updateById(id, updateFields)

    if (!updatedProductCategory) {
      throw new AppError('Product Category not found', 404)
    }

    return {
      message: 'Product Category updated successfully',
      productCategory: updatedProductCategory
    }
  } catch (err) {
    throw normalizeWriteError(err, 'Failed to update product category')
  }
}

module.exports = {
  listProductCategories,
  getProductCategoryTree,
  deleteProductCategory,
  deleteManyProductCategories,
  changeProductCategoryStatus,
  changeProductCategoryStatusMany,
  changeProductCategoryPositionMany,
  createProductCategory,
  getProductCategoryDetail,
  editProductCategory
}












