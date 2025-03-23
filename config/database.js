var mongoose = require('mongoose')

module.exports.connect = async () => {
  //# export cái hàm connect ra để sử dụng ở nơi khác
  try {
    await mongoose.connect(process.env.MONGO_URL)
    console.log('Connected to MongoDB successfully!')
  } catch (error) {
    throw new Error(error)
  }
}
