const mongoose = require('mongoose')

const cmsRevisionSchema = new mongoose.Schema(
  {
    entityType: { type: String, enum: ['blog_post', 'cms_page'], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    key: { type: String, trim: true, default: '', index: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    message: { type: String, trim: true, default: '', maxlength: 220 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

cmsRevisionSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
cmsRevisionSchema.index({ entityType: 1, key: 1, createdAt: -1 })

module.exports = mongoose.model('CmsRevision', cmsRevisionSchema, 'cms_revisions')
