const Product = require('../models/products.model')

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
