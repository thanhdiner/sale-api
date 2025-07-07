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
    avatarUrl: String,
    role_id: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active'
    },
    lastLogin: Date
  },
  { timestamps: true }
)

module.exports = mongoose.model('AdminAccount', adminAccountSchema, 'adminAccounts')
