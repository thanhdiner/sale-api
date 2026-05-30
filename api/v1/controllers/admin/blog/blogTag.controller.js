const logger = require('../../../../../config/logger')
const blogTagService = require('../../../services/admin/blog/blogTag.service')


exports.index = async (req, res, next) => {
  try {
    res.status(200).json(await blogTagService.listTags(req.query))
  } catch (err) {
    return next(err)
  }
}

exports.create = async (req, res, next) => {
  try {
    res.status(201).json(await blogTagService.createTag(req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.update = async (req, res, next) => {
  try {
    res.status(200).json(await blogTagService.updateTag(req.params.id, req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.delete = async (req, res, next) => {
  try {
    res.status(200).json(await blogTagService.deleteTag(req.params.id, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.status = async (req, res, next) => {
  try {
    res.status(200).json(await blogTagService.updateTagStatus(req.params.id, req.body.status, req.user))
  } catch (err) {
    return next(err)
  }
}










