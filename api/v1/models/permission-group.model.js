const mongoose = require('mongoose')

const permissionGroupSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    value: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 50,
      match: /^[a-z0-9_]+$/
    },
    description: {
      type: String,
      default: '',
      maxlength: 300
    },
    isActive: {
      type: Boolean,
      default: true
    },
    deleted: {
      type: Boolean,
      default: false
    },
    createdBy: {
      account_id: String
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model('PermissionGroup', permissionGroupSchema, 'permissionGroups')
