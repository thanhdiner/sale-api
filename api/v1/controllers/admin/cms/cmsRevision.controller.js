const logger = require('../../../../../config/logger')
const cmsRevisionService = require('../../../services/admin/cms/cmsRevision.service')


exports.index = async (req, res, next) => {
  try {
    res.status(200).json(await cmsRevisionService.listRevisions(req.query))
  } catch (err) {
    return next(err)
  }
}

exports.restore = async (req, res, next) => {
  try {
    res.status(200).json(await cmsRevisionService.restoreRevision(req.params.id, req.user))
  } catch (err) {
    return next(err)
  }
}










