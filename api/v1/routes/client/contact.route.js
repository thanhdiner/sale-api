const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/contact.controller')

const { createRateLimiter } = require('../../middlewares/client/rateLimit.middleware')
const validate = require('../../middlewares/validate.middleware')
const { sendContact } = require('../../validations/contact.validation')

router.post('/', createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 }), validate(sendContact), controller.sendContactEmail)

module.exports = router

