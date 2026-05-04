const mongoose = require('mongoose')

const cmsPageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true, maxlength: 80 },
    title: { type: String, trim: true, default: '', maxlength: 180 },
    slug: { type: String, trim: true, lowercase: true, default: '', maxlength: 220 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    seo: {
      title: { type: String, trim: true, default: '', maxlength: 180 },
      description: { type: String, trim: true, default: '', maxlength: 300 },
      thumbnail: { type: String, trim: true, default: '', maxlength: 500 }
    },
    sections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    draftSections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    scheduledAt: { type: Date, default: null },
    scheduleStatus: { type: String, enum: ['none', 'scheduled'], default: 'none', index: true },
    publishedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('CmsPage', cmsPageSchema, 'cms_pages')
