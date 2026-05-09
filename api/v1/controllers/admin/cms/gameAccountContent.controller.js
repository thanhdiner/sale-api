const gameAccountContentService = require('../../../services/shared/cms/gameAccountContent.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: () => gameAccountContentService.getAdminGameAccountContent(),
  logMessage: '[Admin] Error retrieving game account content:',
  errorMessage: 'Failed to retrieve game account content'
})

exports.update = createControllerAction({
  handler: req => gameAccountContentService.updateGameAccountContent(req.body, req.user),
  logMessage: '[Admin] Error updating game account content:',
  errorMessage: 'Failed to update game account content'
})










