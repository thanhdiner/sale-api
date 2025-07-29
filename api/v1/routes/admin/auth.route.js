const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/auth.controller')

router.post('/login', controller.login)
router.post('/refresh-token', controller.refreshToken)
router.post('/logout', controller.logout)
router.post('/2fa-verify', controller.verify2FA)

module.exports = router
