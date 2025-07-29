const mongoose = require('mongoose')

const clientRefreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  }
})

clientRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('ClientRefreshToken', clientRefreshTokenSchema, 'clientRefreshTokens')
