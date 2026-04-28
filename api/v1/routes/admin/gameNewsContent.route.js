const express = require('express')
const controller = require('../../controllers/admin/gameNewsContent.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_game_news_content'), controller.show)
router.patch('/', checkPermission.checkPermission('edit_game_news_content'), controller.update)

module.exports = router
