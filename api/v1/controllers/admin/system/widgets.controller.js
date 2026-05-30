const logger = require('../../../../../config/logger')
const widgetsService = require('../../../services/admin/system/widgets.service')

//# GET /api/v1/admin/widgets
module.exports.index = async (req, res, next) => {
  try {
    const result = await widgetsService.listWidgets({
      ...req.query,
      language: req.get('accept-language')
    })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/widgets
module.exports.create = async (req, res, next) => {
  try {
    const result = await widgetsService.createWidget(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/widgets/:id
module.exports.edit = async (req, res, next) => {
  try {
    const result = await widgetsService.updateWidget(req.params.id, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# DELETE /api/v1/admin/widgets/:id
module.exports.delete = async (req, res, next) => {
  try {
    const result = await widgetsService.deleteWidget(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










