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

module.exports.upload = (req, res, next) => {
  if (req.file) {
    let streamUpload = req => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) resolve(result)
          else reject(error)
        })
        streamifier.createReadStream(req.file.buffer).pipe(stream)
      })
    }

    async function upload(req) {
      let result = await streamUpload(req)
      req.body[req.file.fieldname] = result.secure_url
      next()
    }

    upload(req)
  } else next()
}

module.exports.uploadMany = async (req, res, next) => {
  if (req.files && Object.keys(req.files).length > 0) {
    const entries = Object.entries(req.files)

    try {
      for (const [field, files] of entries) {
        const file = files[0]
        const result = await new Promise((resolve, reject) => {
          let stream = cloudinary.uploader.upload_stream((error, result) => {
            if (result) resolve(result)
            else reject(error)
          })
          streamifier.createReadStream(file.buffer).pipe(stream)
        })
        req.body[field] = result.secure_url
      }
    } catch (err) {
      logger.error('Failed to upload image:', err.message)
      return res.status(500).json({ error: 'Failed to upload image to cloud' })
    }
  }
  next()
}

module.exports.deleteImage = async (req, res, next) => {
  const { oldImage, deleteImage } = req.body

  try {
    if (oldImage && (deleteImage === 'true' || req.file)) {
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
  if (typeof oldImages === 'string') oldImages = JSON.parse(oldImages)
  if (typeof deleteImages === 'string') deleteImages = JSON.parse(deleteImages)

  logger.debug('Deleting old images:', { oldImages, deleteImages })

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

module.exports.uploadImageFromUrl = async (url, publicId = undefined) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data, 'binary')
  return new Promise((resolve, reject) => {
    const upload_stream = cloudinary.uploader.upload_stream(
      { folder: 'avatars', public_id: publicId, overwrite: true },
      (error, result) => {
        if (result) resolve(result)
        else reject(error)
      }
    )
    streamifier.createReadStream(buffer).pipe(upload_stream)
  })
}
