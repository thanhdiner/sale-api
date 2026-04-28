const express = require('express')
const controller = require('../../controllers/admin/gameAccountContent.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_game_account_content'), controller.show)
router.patch('/', checkPermission.checkPermission('edit_game_account_content'), controller.update)

module.exports = router
