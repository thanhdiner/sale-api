const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/permissions.controller')

router.get('/', controller.index)
router.post('/create', controller.create)
router.patch('/edit/:id', controller.edit)
router.patch('/delete/:id', controller.delete)

module.exports = router
