const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository('cooperationContact', {
  legacy: {
    collectionName: 'cooperation_contact_contents',
    query: {}
  }
})










