const express = require('express')
const router = express.Router()

router.get('/', (req, res) => {
  res.send('product')
})

router.get('/:slug', (req, res) => {
  res.send('product detail')
})

module.exports = router
