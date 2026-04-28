const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      maxlength: 300,
      default: ''
    },
    translations: {
      en: {
        label: {
          type: String,
          trim: true,
          maxlength: 100,
          default: ''
        },
        description: {
          type: String,
          maxlength: 300,
          default: ''
        }
      }
    },
    permissions: [{ type: String }],
    isActive: {
      type: Boolean,
      default: true
    },
    deleted: {
      type: Boolean,
      default: false
    },
    createdBy: {
      account_id: String,
      createAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('Role', roleSchema, 'roles')
