const mongoose = require('mongoose')

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }
  },
  { _id: false }
)

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [wishlistItemSchema]
  },
  { timestamps: true }
)

const Wishlist = mongoose.model('Wishlist', wishlistSchema, 'wishlists')
module.exports = Wishlist









