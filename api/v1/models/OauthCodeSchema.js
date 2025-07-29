const mongoose = require('mongoose')

const OauthCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  userId: { type: mongoose.Types.ObjectId, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) },
  used: { type: Boolean, default: false }
})

OauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('OauthCode', OauthCodeSchema, 'oauthCodes')
