const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const userSchema = new mongoose.Schema(
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
    facebookId: { type: String, unique: true, sparse: true },
    githubId: { type: String, unique: true, sparse: true },
    phone: String,
    passwordHash: {
      type: String,
      default: ''
    },
    fullName: String,
    avatarUrl: String,
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

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10)
  next()
})

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash)
}

userSchema.methods.setPassword = function (newPassword) {
  this.passwordHash = newPassword
  return this.save()
}
module.exports = mongoose.model('User', userSchema, 'users')
