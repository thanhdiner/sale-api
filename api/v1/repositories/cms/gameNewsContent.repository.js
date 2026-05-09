const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository('gameNews', {
  legacy: {
    collectionName: 'game_news_contents',
    query: {}
  }
})










