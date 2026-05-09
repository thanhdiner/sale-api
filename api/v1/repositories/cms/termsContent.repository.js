const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository('terms', {
  legacy: {
    collectionName: 'terms_contents',
    query: {}
  }
})










