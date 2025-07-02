const ProductCategory = require('../../models/product-category.model')
const paginationHelper = require('../../helpers/pagination')

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
    console.error(err)
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
    console.error(err)
    return res.status(500).json({ error: 'Failed to change product category positions', status: 400 })
  }
}
