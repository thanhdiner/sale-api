const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const { extractPublicId } = require('../../helpers/cloudinary')
const axios = require('axios')
const logger = require('../../../../config/logger')

//# Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true
})
//# End Configure Cloudinary

const uploadBufferToCloudinary = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (result) resolve(result)
      else reject(error)
    })

    streamifier.createReadStream(file.buffer).pipe(stream)
  })
}

const parseJsonArray = value => {
  if (!value) return []

  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

module.exports.upload = async (req, res, next) => {
  try {
    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file)
      req.body[req.file.fieldname] = result.secure_url
    }

    return next()
  } catch (err) {
    logger.error('Failed to upload image:', err.message)

    return res.status(500).json({
      error: 'Failed to upload image to cloud'
    })
  }
}

module.exports.uploadMany = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next()
    }

    const uploadedFiles = {}

    for (const [field, files] of Object.entries(req.files)) {
      if (!Array.isArray(files) || files.length === 0) continue

      const uploadedUrls = []

      for (const file of files) {
        const result = await uploadBufferToCloudinary(file)
        uploadedUrls.push(result.secure_url)
      }

      uploadedFiles[field] = uploadedUrls

      // Các field 1 ảnh: logo, favicon, thumbnail, dailySuggestionBannerImg...
      if (files.length === 1 && field !== 'images') {
        req.body[field] = uploadedUrls[0]
      } else {
        req.body[field] = uploadedUrls
      }
    }

    req.uploadedFiles = uploadedFiles

    return next()
  } catch (err) {
    logger.error('Failed to upload images:', err.message)

    return res.status(500).json({
      error: 'Failed to upload images to cloud'
    })
  }
}

module.exports.deleteImage = async (req, res, next) => {
  const { oldImage, deleteImage } = req.body

  try {
    const hasNewSingleFile = !!req.file
    const hasNewThumbnail = !!req.files?.thumbnail?.[0]
    const shouldDelete = deleteImage === 'true' || hasNewSingleFile || hasNewThumbnail

    if (oldImage && shouldDelete) {
      const publicId = extractPublicId(oldImage)

      await cloudinary.uploader.destroy(publicId)

      logger.info('Deleted old image from Cloudinary:', { publicId })
    }
  } catch (err) {
    logger.error('Failed to delete image:', err.message)
  }

  next()
}

module.exports.deleteImageMany = async (req, res, next) => {
  let { oldImages = [], deleteImages = [] } = req.body

  oldImages = parseJsonArray(oldImages)
  deleteImages = parseJsonArray(deleteImages)

  logger.debug('Deleting old images:', {
    oldImages,
    deleteImages
  })

  try {
    for (let i = 0; i < oldImages.length; i++) {
      const oldImage = oldImages[i]
      const shouldDelete = deleteImages[i] === 'true' || deleteImages[i] === true

      if (oldImage && shouldDelete) {
        const publicId = extractPublicId(oldImage)

        await cloudinary.uploader.destroy(publicId)

        logger.info('Deleted old image from Cloudinary:', { publicId })
      }
    }
  } catch (err) {
    logger.error('Failed to delete images:', err.message)
  }

  next()
}

module.exports.uploadBufferToCloudinary = uploadBufferToCloudinary

module.exports.uploadImageFromUrl = async (url, publicId = undefined) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data, 'binary')

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'avatars',
        public_id: publicId,
        overwrite: true
      },
      (error, result) => {
        if (result) resolve(result)
        else reject(error)
      }
    )

    streamifier.createReadStream(buffer).pipe(uploadStream)
  })
}