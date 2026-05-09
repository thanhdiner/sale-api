const { default: slugify } = require('slugify')
const generateUniqueSlug = require('./generateUniqueSlug')

const handleSlug = async ({ Model, source, slugInput, title, currentId = null }) => {
  const dataSource = source || Model
  const hasUserInput = typeof slugInput === 'string' && slugInput.trim().length > 0
  const slugBase = slugify(hasUserInput ? slugInput.trim() : title, { lower: true })
  const existed = await dataSource.findOne({
    slug: slugBase,
    ...(currentId && { _id: { $ne: currentId } })
  })

  if (existed) {
    if (hasUserInput) {
      const suggestedSlug = await generateUniqueSlug(dataSource, slugBase)
      return { error: 'Slug already exists', suggestedSlug }
    }

    const uniqueSlug = await generateUniqueSlug(dataSource, slugBase)
    return { slug: uniqueSlug }
  }

  return { slug: slugBase }
}

module.exports = handleSlug









