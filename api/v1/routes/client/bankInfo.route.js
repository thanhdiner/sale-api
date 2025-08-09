const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/bankInfo.controller')

router.get('/active', controller.getActiveBankInfo)

module.exports = router
