const returnPolicyPageService = require('../../../services/shared/cms/returnPolicyPage.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => returnPolicyPageService.getClientReturnPolicyPage(getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving return policy page content:',
  errorMessage: 'Failed to retrieve return policy page content'
})










