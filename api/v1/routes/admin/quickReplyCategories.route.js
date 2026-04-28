const express = require('express')
const controller = require('../../controllers/admin/quickReplyCategories.controller')

const router = express.Router()

router.get('/', controller.getCategories)
router.post('/', controller.createCategory)
router.patch('/:id', controller.updateCategory)
router.delete('/:id', controller.deleteCategory)

module.exports = router
