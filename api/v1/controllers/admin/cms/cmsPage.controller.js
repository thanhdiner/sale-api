const logger = require('../../../../../config/logger')
const cmsPageService = require('../../../services/admin/cms/cmsPage.service')


exports.show = async (req, res, next) => {
  try {
    const result = await cmsPageService.getCmsPage(req.params.key)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

exports.saveDraft = async (req, res, next) => {
  try {
    const result = await cmsPageService.saveDraft(req.params.key, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

exports.schedule = async (req, res, next) => {
  try {
    const result = await cmsPageService.schedulePage(req.params.key, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

exports.publishDue = async (req, res, next) => {
  try {
    const result = await cmsPageService.publishDuePages()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

exports.publish = async (req, res, next) => {
  try {
    const result = await cmsPageService.publishPage(req.params.key, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










