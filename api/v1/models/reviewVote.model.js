const mongoose = require('mongoose')

const reviewVoteSchema = new mongoose.Schema(
  {
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

// Ensure 1 vote per user per review
reviewVoteSchema.index({ reviewId: 1, userId: 1 }, { unique: true })

module.exports = mongoose.model('ReviewVote', reviewVoteSchema)
