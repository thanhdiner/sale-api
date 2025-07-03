const { default: slugify } = require('slugify')
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

const generateUniqueSlug = async baseSlug => {
  const regex = new RegExp(`^${baseSlug}(-\\d+)?$`, 'i')
  const existingSlugs = await ProductCategory.find({ slug: regex }).select('slug')

  if (!existingSlugs.length) return baseSlug

  const numbers = existingSlugs.map(p => {
    const match = p.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`))
    return match ? parseInt(match[1]) : 0
  })

  const maxSuffix = Math.max(...numbers, 0)
  return `${baseSlug}-${maxSuffix + 1}`
}

const handleSlug = async ({ slugInput, title, currentId = null }) => {
  const hasUserInput = typeof slugInput === 'string' && slugInput.trim().length > 0
  const slugBase = slugify(hasUserInput ? slugInput.trim() : title, { lower: true })
  const existed = await ProductCategory.findOne({
    slug: slugBase,
    ...(currentId && { _id: { $ne: currentId } })
  })

  if (existed) {
    if (hasUserInput) {
      const suggestedSlug = await generateUniqueSlug(slugBase)
      return { error: 'Slug already exists', suggestedSlug }
    } else {
      const uniqueSlug = await generateUniqueSlug(slugBase)
      return { slug: uniqueSlug }
    }
  }

  return { slug: slugBase }
}

module.exports = {
  buildTree,
  validateParentId,
  setDefaultPosition,
  generateUniqueSlug,
  handleSlug
}
