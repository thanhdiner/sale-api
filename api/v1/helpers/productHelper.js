const { default: slugify } = require('slugify')
const Product = require('../models/products.model')
const { generateUniqueSlug } = require('./slugify')

module.exports.parseIntegerFields = (body, fields) => {
  fields.forEach(field => {
    if (body[field] !== undefined) body[field] = parseInt(body[field])
  })
}

module.exports.setDefaultPosition = async body => {
  if (body.position === undefined || body.position === null || isNaN(body.position)) {
    const countProducts = await Product.countDocuments()
    body.position = countProducts + 1
  } else body.position = parseInt(body.position)
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
