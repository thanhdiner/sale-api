const mongoose = require('mongoose')

const permissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    group: { type: String },
    deleted: { type: Boolean, default: false },
    deletedAt: Date
  },
  { timestamps: true }
)

module.exports = mongoose.model('Permission', permissionSchema, 'permissions')
