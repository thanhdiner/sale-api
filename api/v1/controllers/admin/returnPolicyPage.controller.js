const returnPolicyPageService = require('../../services/returnPolicyPage.service')
const { createControllerAction } = require('../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: () => returnPolicyPageService.getAdminReturnPolicyPage(),
  logMessage: '[Admin] Error retrieving return policy page content:',
  errorMessage: 'Failed to retrieve return policy page content'
})

exports.update = createControllerAction({
  handler: req => returnPolicyPageService.updateReturnPolicyPage(req.body, req.user),
  logMessage: '[Admin] Error updating return policy page content:',
  errorMessage: 'Failed to update return policy page content',
  handleKnownErrors: true
})
