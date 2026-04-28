const contactPageService = require('../../services/contactPage.service')
const { createControllerAction } = require('../../factories/singletonContent.factory')

exports.show = createControllerAction({
  handler: () => contactPageService.getAdminContactPage(),
  logMessage: '[Admin] Error retrieving contact page content:',
  errorMessage: 'Failed to retrieve contact page content'
})

exports.update = createControllerAction({
  handler: req => contactPageService.updateContactPage(req.body, req.user),
  logMessage: '[Admin] Error updating contact page content:',
  errorMessage: 'Failed to update contact page content',
  handleKnownErrors: true
})
