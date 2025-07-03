const ProductCategory = require('../models/product-category.model')

const buildTree = (categories, parent = '') => {
  return categories
    .filter(item => (item.parent_id || '') === (typeof parent === 'object' ? parent.toString() : parent))
    .map(item => ({
      title: item.title,
      value: item._id,
      children: buildTree(categories, item._id)
    }))
}

const validateParentId = async (parentId, currentId = null) => {
  if (!parentId) return { ok: true }
  if (currentId && parentId === currentId) return { ok: false, error: 'A category cannot be its own parent' }
  const parent = await ProductCategory.findOne({ _id: parentId, deleted: false })
  if (!parent) return { ok: false, error: 'Parent category does not exist' }
  return { ok: true }
}

const setDefaultPosition = async body => {
  if (body.position === undefined || body.position === null || isNaN(body.position)) {
    const countProductCategories = await ProductCategory.countDocuments()
    body.position = countProductCategories + 1
  } else body.position = parseInt(body.position)
}

module.exports = {
  buildTree,
  validateParentId,
  setDefaultPosition
}
