const { default: slugify } = require('slugify')
const generateUniqueSlug = require('./generateUniqueSlug')

const handleSlug = async ({ Model, slugInput, title, currentId = null }) => {
  const hasUserInput = typeof slugInput === 'string' && slugInput.trim().length > 0
  const slugBase = slugify(hasUserInput ? slugInput.trim() : title, { lower: true })
  const existed = await Model.findOne({
    slug: slugBase,
    ...(currentId && { _id: { $ne: currentId } })
  })

  if (existed) {
    if (hasUserInput) {
      const suggestedSlug = await generateUniqueSlug(Model, slugBase)
      return { error: 'Slug already exists', suggestedSlug }
    } else {
      const uniqueSlug = await generateUniqueSlug(Model, slugBase)
      return { slug: uniqueSlug }
    }
  }

  return { slug: slugBase }
}

module.exports = handleSlug
