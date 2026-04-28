const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository(null, {
  exposeKey: true,
  legacy: {
    collectionName: 'coming_soon_contents',
    query: key => ({ key })
  }
})
