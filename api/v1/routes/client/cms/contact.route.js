const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/cms/contact.controller')
const contactPageController = require('../../../controllers/client/cms/contactPage.controller')

const { createRateLimiter } = require('../../../middlewares/security/rateLimit.middleware')
const validate = require('../../../middlewares/validation/validate.middleware')
const { sendContact } = require('../../../validations/cms/contact.validation')

router.get('/page', contactPageController.show)
router.post('/', createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 }), validate(sendContact), controller.sendContactEmail)

module.exports = router













