const { createFlatContentPageRepository } = require('./contentPage.repository')

module.exports = createFlatContentPageRepository('homeBuildYourKit', {
  legacy: {
    collectionName: 'home_build_your_kit_contents',
    query: {}
  }
})

