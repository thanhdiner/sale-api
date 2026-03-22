const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/auth.controller')

const validate = require('../../middlewares/validate.middleware')
const adminAuthSchemas = require('../../validations/adminAuth.validation')

router.post('/login', validate(adminAuthSchemas.login), controller.login)
router.post('/refresh-token', controller.refreshToken)
router.post('/logout', controller.logout)
router.post('/2fa-verify', validate(adminAuthSchemas.verify2FA), controller.verify2FA)

module.exports = router

