const ProductCategory = require('../../models/product-category.model')
const paginationHelper = require('../../helpers/pagination')
const parseIntegerFields = require('../../utils/parseIntegerFields')
const { buildTree, validateParentId, setDefaultPosition, handleSlug } = require('../../helpers/product-categoryHelper')

//# Get /api/v1/admin/product-categories
module.exports.index = async (req, res) => {
  try {
    let find = {
      deleted: false
    }

    const { status, categoryName, position, sortField, sortOrder } = req.query

    if (status && status !== 'all') find.status = status
    if (categoryName) find.title = { $regex: categoryName, $options: 'i' }
    if (position) find.position = +position

    //@ pagination
    let initPagination = {
      currentPage: 1,
      limitItems: 10
    }

    const countProductCategories = await ProductCategory.countDocuments(find)

    let objectPagination = paginationHelper(initPagination, req.query, countProductCategories)

    //@ sorting
    let sort = {}
    if (sortField && sortOrder) sort[sortField] = sortOrder === 'descend' ? -1 : 1
    else sort['position'] = -1

    const productCategories = await ProductCategory.find(find).sort(sort).limit(objectPagination.limitItems).skip(objectPagination.skip)

    res.json({
      productCategories,
      total: countProductCategories,
      currentPage: objectPagination.currentPage,
      totalPage: objectPagination.totalPage,
      limitItems: objectPagination.limitItems
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# Get /api/v1/admin/product-categories/tree
module.exports.getProductCategoryTree = async (req, res) => {
  try {
    const categories = await ProductCategory.find({ deleted: false })
    const treeData = buildTree(categories)
    res.json(treeData)
  } catch (error) {
    res.status(500).json({ error: 'Server error', status: 500 })
  }
}

//# Patch /api/v1/admin/product-categories/delete/:id
module.exports.delete = async (req, res) => {
  try {
    await ProductCategory.updateOne(
      { _id: req.params.id },
      {
        deleted: true
      }
    )
    res.json({
      code: 200,
      message: 'Product Category deleted successfully!'
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product category', status: 400 })
  }
}

//# Patch /api/v1/admin/product-categories/deleteMany
module.exports.deleteMany = async (req, res) => {
  try {
    const ids = req.body.ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request data', status: 400 })
    }

    await ProductCategory.updateMany({ _id: { $in: ids } }, { $set: { deleted: true } })

    res.json({
      code: 200,
      message: `🗑️ Deleted ${ids.length} product categories successfully!`
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product categories', status: 400 })
  }
}

//# Patch /api/v1/admin/product-categories/changeStatus/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const newStatus = req.body.status === 'active' ? 'inactive' : 'active'
    await ProductCategory.updateOne(
      { _id: req.params.id },
      {
        status: newStatus
      }
    )
    res.json({
      code: 200,
      message: 'Product Category status changed successfully!',
      status: newStatus
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to change product category status', status: 400 })
  }
}

//# PATCH /api/v1/admin/product-categories/changeStatusMany
module.exports.changeStatusMany = async (req, res) => {
  try {
    const { ids, status } = req.body

    if (!Array.isArray(ids) || ids.length === 0 || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid request data', status: 400 })
    }

    await ProductCategory.updateMany({ _id: { $in: ids } }, { $set: { status } })

    res.json({
      code: 200,
      message: `✅ Changed status of ${ids.length} product categories to "${status}"`,
      status
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to change product category statuses', status: 400 })
  }
}

//# PATCH /api/v1/admin/product-categories/change-position-many
module.exports.changePositionMany = async (req, res) => {
  try {
    const { data } = req.body
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid data' })
    }

    const bulkOps = data.map(({ _id, position }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { position } }
      }
    }))

    await ProductCategory.bulkWrite(bulkOps)

    res.json({
      code: 200,
      message: `✅ Updated position for ${data.length} product categories`
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to change product category positions', status: 400 })
  }
}

//# Post /api/v1/admin/product-categories/create
module.exports.create = async (req, res) => {
  try {
    await setDefaultPosition(req.body)

    const check = await validateParentId(req.body.parent_id)
    if (!check.ok) return res.status(400).json({ error: check.error })

    const { slug, error, suggestedSlug } = await handleSlug({ slugInput: req.body.slug, title: req.body.title })
    if (error) return res.status(400).json({ error, suggestedSlug })
    req.body.slug = slug

    const productCategory = new ProductCategory(req.body)
    const data = await productCategory.save()

    res.json({
      code: 200,
      message: ' Product Category created successfully!',
      data: data
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product category', status: 400 })
  }
}

//# Get /api/v1/product-categories/:id
module.exports.detail = async (req, res) => {
  try {
    const productCategory = await ProductCategory.findById(req.params.id)
    if (!productCategory) return res.status(404).json({ message: 'Product Category not found' })
    res.json({ code: 200, message: ' Get Product Category successfully!', productCategory })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
}

//# PATCH /api/v1/admin/product-categories/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const productCategoryId = req.params.id
    parseIntegerFields(req.body, ['position'])

    const check = await validateParentId(req.body.parent_id, productCategoryId)
    if (!check.ok) return res.status(400).json({ error: check.error })

    const { slug, error, suggestedSlug } = await handleSlug({
      slugInput: req.body.slug,
      title: req.body.title,
      currentId: productCategoryId
    })
    if (error) return res.status(400).json({ error, suggestedSlug })
    req.body.slug = slug

    const updatedProductCategory = await ProductCategory.findByIdAndUpdate(productCategoryId, req.body, {
      new: true,
      runValidators: true
    })
    return res.status(200).json({
      message: '✅ Product Category updated successfully',
      productCategory: updatedProductCategory
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update product category', status: 400 })
  }
}
