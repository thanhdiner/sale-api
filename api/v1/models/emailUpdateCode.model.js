const mongoose = require('mongoose')

const emailUpdateCodeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  newEmail: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
})

emailUpdateCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('EmailUpdateCode', emailUpdateCodeSchema, 'emailUpdateCodes')
