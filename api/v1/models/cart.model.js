const mongoose = require('mongoose')

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    price: Number,
    salePrice: Number,
    quantity: Number,
    image: String,
    slug: String,
    isFlashSale: Boolean,
    flashSaleId: mongoose.Schema.Types.ObjectId,
    discountPercentage: Number
  },
  { _id: false }
)

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
    promoCode: { type: String, trim: true, uppercase: true, default: '' },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

const Cart = mongoose.model('Cart', cartSchema, 'carts')
module.exports = Cart
