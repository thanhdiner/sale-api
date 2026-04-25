const mongoose = require('mongoose')
const adminAccountRepository = require('../../repositories/adminAccount.repository')
const AppError = require('../../utils/AppError')

function ensureValidObjectId(id, message = 'Admin not found') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 404)
  }
}

async function getCurrentAdminProfile(userId) {
  ensureValidObjectId(userId)

  const admin = await adminAccountRepository.findById(userId, {
    select: '-passwordHash -__v',
    populate: { path: 'role_id', select: 'label permissions' }
  })

  if (!admin) {
    throw new AppError('Admin not found', 404)
  }

  return admin
}

module.exports = {
  getCurrentAdminProfile
}
