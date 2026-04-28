const gameNewsContentService = require('../../services/gameNewsContent.service')
const { createControllerAction } = require('../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: () => gameNewsContentService.getAdminGameNewsContent(),
  logMessage: '[Admin] Error retrieving game news content:',
  errorMessage: 'Failed to retrieve game news content'
})

exports.update = createControllerAction({
  handler: req => gameNewsContentService.updateGameNewsContent(req.body, req.user),
  logMessage: '[Admin] Error updating game news content:',
  errorMessage: 'Failed to update game news content'
})
