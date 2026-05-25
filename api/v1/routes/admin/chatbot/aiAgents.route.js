const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/chatbot/aiAgents.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')
const multer = require('multer')
const uploadCloud = require('../../../middlewares/upload/uploadCloud.middleware')

const fileUpload = multer()

router.get('/', checkPermission.checkPermission('view_chatbot_config'), controller.listAgents)
router.post(
  '/create',
  checkPermission.checkPermission('edit_chatbot_config'),
  fileUpload.single('avatar'),
  uploadCloud.upload,
  controller.createAgent
)
router.patch(
  '/update/:id',
  checkPermission.checkPermission('edit_chatbot_config'),
  fileUpload.single('avatar'),
  uploadCloud.deleteImage,
  uploadCloud.upload,
  controller.updateAgent
)
router.patch('/toggle/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.toggleAgent)
router.patch('/set-default/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.setDefaultAgent)
router.patch('/reorder/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.reorderAgent)
router.delete('/delete/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.deleteAgent)

module.exports = router
