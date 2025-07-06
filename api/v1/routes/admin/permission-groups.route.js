const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/permission-groups.controller')

router.get('/', controller.index)
router.post('/create', controller.create)
router.patch('/edit/:id', controller.edit)
router.patch('/delete/:id', controller.delete)
router.patch('/toggle-active/:id', controller.toggleActive)

module.exports = router
