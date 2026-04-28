const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository('gameAccount', {
  legacy: {
    collectionName: 'game_account_contents',
    query: {}
  }
})
