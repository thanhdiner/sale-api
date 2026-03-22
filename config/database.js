const mongoose = require('mongoose')
const logger = require('./logger')

module.exports.connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL)
    logger.info('Connected to MongoDB successfully!')
  } catch (error) {
    logger.error('MongoDB connection failed:', error)
    throw new Error(error)
  }
}
