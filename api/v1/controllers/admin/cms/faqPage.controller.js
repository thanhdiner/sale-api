const faqPageService = require('../../../services/shared/cms/faqPage.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: () => faqPageService.getAdminFaqPage(),
  logMessage: '[Admin] Error retrieving FAQ page content:',
  errorMessage: 'Failed to retrieve FAQ page content'
})

exports.update = createControllerAction({
  handler: req => faqPageService.updateFaqPage(req.body, req.user),
  logMessage: '[Admin] Error updating FAQ page content:',
  errorMessage: 'Failed to update FAQ page content',
  handleKnownErrors: true
})










