const mongoose = require('mongoose')

const adminTrustedDeviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', required: true },
    deviceId: String,
    name: String,
    browser: String,
    location: String,
    lastUsed: Date,
    current: Boolean
  },
  { timestamps: true }
)

module.exports = mongoose.model('AdminTrustedDevice', adminTrustedDeviceSchema, 'adminTrustedDevices')









