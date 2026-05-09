const mongoose = require('mongoose')

const bankInfoSchema = new mongoose.Schema(
  {
    bankName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    qrCode: { type: String, trim: true, default: '', maxlength: 500 },
    accountHolder: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    noteTemplate: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    translations: {
      en: {
        bankName: { type: String, trim: true, default: '', maxlength: 100 },
        accountHolder: { type: String, trim: true, default: '', maxlength: 100 },
        noteTemplate: { type: String, trim: true, default: '', maxlength: 255 }
      }
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    createdBy: {
      account_id: String,
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('BankInfo', bankInfoSchema, 'bank_infos')









