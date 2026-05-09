const privacyPolicyPageService = require('../../../services/shared/cms/privacyPolicyPage.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => privacyPolicyPageService.getClientPrivacyPolicyPage(getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving privacy policy content:',
  errorMessage: 'Failed to retrieve privacy policy content'
})










