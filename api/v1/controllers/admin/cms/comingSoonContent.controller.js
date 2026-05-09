const comingSoonContentService = require('../../../services/shared/cms/comingSoonContent.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: req => comingSoonContentService.getAdminComingSoonContent(req.params.key),
  logMessage: '[Admin] Error retrieving coming soon content:',
  errorMessage: 'Failed to retrieve coming soon content',
  handleKnownErrors: true
})

exports.update = createControllerAction({
  handler: req => comingSoonContentService.updateComingSoonContent(req.params.key, req.body, req.user),
  logMessage: '[Admin] Error updating coming soon content:',
  errorMessage: 'Failed to update coming soon content',
  handleKnownErrors: true
})










