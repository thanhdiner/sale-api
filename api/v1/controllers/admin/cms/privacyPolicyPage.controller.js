const privacyPolicyPageService = require('../../../services/shared/cms/privacyPolicyPage.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: () => privacyPolicyPageService.getAdminPrivacyPolicyPage(),
  logMessage: '[Admin] Error retrieving privacy policy content:',
  errorMessage: 'Failed to retrieve privacy policy content'
})

exports.update = createControllerAction({
  handler: req => privacyPolicyPageService.updatePrivacyPolicyPage(req.body, req.user),
  logMessage: '[Admin] Error updating privacy policy content:',
  errorMessage: 'Failed to update privacy policy content',
  handleKnownErrors: true
})










