const { createContentPageRepository } = require('./contentPage.repository')

module.exports = createContentPageRepository({
  legacy: {
    collectionName: 'contactPages'
  }
})
