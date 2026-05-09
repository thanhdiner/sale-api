const mongoose = require('mongoose')

const adminAccountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 4,
      maxlength: 32
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100
    },
    passwordHash: {
      type: String,
      required: true
    },
    fullName: String,
    translations: {
      en: {
        fullName: { type: String, trim: true, default: '' }
      }
    },
    avatarUrl: String,
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active'
    },
    lastLogin: Date,
    twoFAEnabled: {
      type: Boolean,
      default: false
    },
    twoFASecret: String,
    backupCodes: [
      {
        code: String,
        used: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
)

adminAccountSchema.index({ deleted: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('AdminAccount', adminAccountSchema, 'adminAccounts')









