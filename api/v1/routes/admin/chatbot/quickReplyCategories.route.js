const express = require('express')
const controller = require('../../../controllers/admin/chatbot/quickReplyCategories.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_quick_replies'), controller.getCategories)
router.post('/', checkPermission.checkPermission('create_quick_reply'), controller.createCategory)
router.patch('/:id', checkPermission.checkPermission('edit_quick_reply'), controller.updateCategory)
router.delete('/:id', checkPermission.checkPermission('delete_quick_reply'), controller.deleteCategory)

module.exports = router











