const Product = require('../../models/products.model')
const paginationHelper = require('../../helpers/pagination')

//# Get /products
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

//# Get /products/:slug
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
