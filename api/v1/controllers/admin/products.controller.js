const Product = require('../../models/products.model')
const paginationHelper = require('../../helpers/pagination')

//# Get /api/v1/admin/products
module.exports.index = async (req, res) => {
  try {
    let find = {
      deleted: 'false'
    }

    //@ pagination
    let initPagination = {
      currentPage: 1,
      limitItems: 10
    }

    const countProducts = await Product.countDocuments(find)

    let objectPagination = paginationHelper(initPagination, req.query, countProducts)

    const products = await Product.find(find).sort({ position: 'desc' }).limit(objectPagination.limitItems).skip(objectPagination.skip)

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

//# Get /api/v1/products/:slug
// module.exports.detail = async (req, res) => {
//   try {
//     const product = await Product.findOne({
//       deleted: false,
//       status: 'active',
//       slug: req.params.slug
//     })

//     product.priceNew = productsHelper.priceNewProduct(product)

//     res.json(product)
//   } catch (error) {
//     res.status(500).json({ error: 'Internal server error', status: 500 })
//   }
// }

//# Post /api/v1/admin/products/create
module.exports.create = async (req, res) => {
  try {
    req.body.price = parseInt(req.body.price)
    req.body.discountPercentage = parseInt(req.body.discountPercentage)
    req.body.stock = parseInt(req.body.stock)
    if (req.body.position === undefined || req.body.position === null || isNaN(req.body.position)) {
      const countProducts = await Product.countDocuments()
      req.body.position = countProducts + 1
    } else {
      req.body.position = parseInt(req.body.position)
    }

    const product = new Product(req.body)
    const data = await product.save()

    res.json({
      code: 200,
      message: ' Product created successfully!',
      data: data
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product', status: 400 })
  }
}

//# Patch /api/v1/admin/products/delete/:id
module.exports.delete = async (req, res) => {
  try {
    await Product.updateOne(
      { _id: req.params.id },
      {
        deleted: true
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
        status: newStatus
      }
    )
    res.json({
      code: 200,
      message: 'Product status changed successfully!',
      status: newStatus
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

    await Product.updateMany({ _id: { $in: ids } }, { $set: { deleted: true } })

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

    await Product.updateMany({ _id: { $in: ids } }, { $set: { status } })

    res.json({
      code: 200,
      message: `✅ Changed status of ${ids.length} products to "${status}"`,
      status
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to change product statuses', status: 400 })
  }
}
