const cloudinary = require('cloudinary').v2
const logger = require('../../../config/logger')

function extractPublicId(url) {
  if (!url) return null

  try {
    const parts = url.split('/')
    const uploadIndex = parts.findIndex(p => p === 'upload')
    if (uploadIndex === -1) return null

    const pathParts = parts.slice(uploadIndex + 1)

    if (pathParts[0].startsWith('v') && /^\bv\d+$/.test(pathParts[0])) {
      pathParts.shift()
    }

    const fileName = pathParts.pop()
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName

    const publicId = [...pathParts, fileNameWithoutExt].join('/')

    return publicId
  } catch {
    return null
  }
}

async function deleteImageFromCloudinary(url) {
  try {
    const publicId = extractPublicId(url)
    if (!publicId) return false
    const result = await cloudinary.uploader.destroy(publicId)
    logger.info('Deleted image from Cloudinary:', { publicId, result: result.result })
    return result.result === 'ok' || result.result === 'not found'
  } catch (err) {
    logger.error('Failed to delete image from Cloudinary:', err)
    return false
  }
}

module.exports = {
  extractPublicId,
  deleteImageFromCloudinary
}









