const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository('about', {
  legacy: {
    collectionName: 'about_contents',
    query: {}
  }
})
