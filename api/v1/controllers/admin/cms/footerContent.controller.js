const footerContentService = require('../../../services/shared/cms/footerContent.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: () => footerContentService.getAdminFooterContent(),
  logMessage: '[Admin] Error retrieving footer content:',
  errorMessage: 'Failed to retrieve footer content'
})

exports.update = createControllerAction({
  handler: req => footerContentService.updateFooterContent(req.body, req.user),
  logMessage: '[Admin] Error updating footer content:',
  errorMessage: 'Failed to update footer content',
  handleKnownErrors: true
})










