const logger = require('../../../../../config/logger')
const meService = require('../../../services/admin/access/me.service')

//# GET /api/v1/admin/me
module.exports.index = async (req, res, next) => {
  try {
    const admin = await meService.getCurrentAdminProfile(req.user?.userId)
    res.json(admin)
  } catch (err) {
    return next(err)
  }
}










