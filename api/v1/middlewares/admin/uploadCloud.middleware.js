const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const { extractPublicId } = require('../../helpers/cloudinary')

//# Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
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
      req.body[req.file.fieldname] = result.url
      next()
    }

    upload(req)
  } else next()
}

module.exports.deleteImage = async (req, res, next) => {
  const { oldImage, deleteImage } = req.body

  try {
    if (oldImage && (deleteImage === 'true' || req.file)) {
      const publicId = extractPublicId(oldImage)
      await cloudinary.uploader.destroy(publicId)
      console.log('🗑️ Deleted old image from Cloudinary:', publicId)
    }
  } catch (err) {
    console.error('❌ Failed to delete image:', err.message)
  }

  next()
}
