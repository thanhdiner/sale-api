const mongoose = require('mongoose')

const mediaAssetSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 700 },
    publicId: { type: String, trim: true, default: '', index: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], default: 'image', index: true },
    mimeType: { type: String, trim: true, default: '', maxlength: 120 },
    size: { type: Number, default: 0 },
    folder: { type: String, trim: true, default: '', maxlength: 160 },
    alt: { type: String, trim: true, default: '', maxlength: 180 },
    tags: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

mediaAssetSchema.index({ resourceType: 1, createdAt: -1 })
mediaAssetSchema.index({ tags: 1 })

module.exports = mongoose.model('MediaAsset', mediaAssetSchema, 'media_assets')









