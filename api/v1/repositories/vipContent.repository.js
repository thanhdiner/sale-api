const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository('vip', {
  legacy: {
    collectionName: 'vip_contents',
    query: {}
  }
})
