const logger = require('../../../../../config/logger')
const mediaLibraryService = require('../../../services/admin/system/mediaLibrary.service')


exports.index = async (req, res, next) => {
  try {
    res.status(200).json(await mediaLibraryService.listAssets(req.query))
  } catch (err) {
    return next(err)
  }
}

exports.update = async (req, res, next) => {
  try {
    res.status(200).json(await mediaLibraryService.updateAsset(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

exports.delete = async (req, res, next) => {
  try {
    res.status(200).json(await mediaLibraryService.deleteAsset(req.params.id))
  } catch (err) {
    return next(err)
  }
}










