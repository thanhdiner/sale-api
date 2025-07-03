const { default: slugify } = require('slugify')
const Product = require('../models/products.model')

module.exports.setDefaultPosition = async body => {
  if (body.position === undefined || body.position === null || isNaN(body.position)) {
    const countProducts = await Product.countDocuments()
    body.position = countProducts + 1
  } else body.position = parseInt(body.position)
}

module.exports.generateUniqueSlug = async baseSlug => {
  const regex = new RegExp(`^${baseSlug}(-\\d+)?$`, 'i')
  const existingSlugs = await Product.find({ slug: regex }).select('slug')

  if (!existingSlugs.length) return baseSlug

  const numbers = existingSlugs.map(p => {
    const match = p.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`))
    return match ? parseInt(match[1]) : 0
  })

  const maxSuffix = Math.max(...numbers, 0)
  return `${baseSlug}-${maxSuffix + 1}`
}

module.exports.handleSlug = async ({ slugInput, title, currentId = null }) => {
  const hasUserInput = typeof slugInput === 'string' && slugInput.trim().length > 0
  const slugBase = slugify(hasUserInput ? slugInput.trim() : title, { lower: true })
  const existed = await Product.findOne({
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
