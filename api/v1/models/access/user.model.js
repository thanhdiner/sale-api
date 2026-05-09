const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const checkoutProfileSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    addressLine1: { type: String, trim: true, default: '' },
    provinceCode: { type: String, trim: true, default: '' },
    provinceName: { type: String, trim: true, default: '' },
    districtCode: { type: String, trim: true, default: '' },
    districtName: { type: String, trim: true, default: '' },
    wardCode: { type: String, trim: true, default: '' },
    wardName: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    deliveryMethod: {
      type: String,
      enum: ['pickup', 'contact'],
      default: 'pickup'
    },
    paymentMethod: {
      type: String,
      enum: ['transfer', 'contact', 'vnpay', 'momo', 'zalopay', 'sepay'],
      default: 'transfer'
    }
  },
  { _id: false }
)

const notificationPreferencesSchema = new mongoose.Schema(
  {
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      browser: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    orderUpdates: { type: Boolean, default: true },
    paymentUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    backInStock: { type: Boolean, default: true },
    wishlistUpdates: { type: Boolean, default: true },
    supportMessages: { type: Boolean, default: true }
  },
  { _id: false }
)

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
    checkoutProfile: {
      type: checkoutProfileSchema,
      default: () => ({})
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({})
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

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  if (!this.passwordHash || !this.passwordHash.trim()) {
    this.passwordHash = ''
    return next()
  }
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

userSchema.virtual('hasPassword').get(function () {
  return !!(this.passwordHash && this.passwordHash.length > 0)
})

userSchema.set('toJSON', { virtuals: true })
userSchema.set('toObject', { virtuals: true })

userSchema.index({ deleted: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('User', userSchema, 'users')









