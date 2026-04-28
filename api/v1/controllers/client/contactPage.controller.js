const contactPageService = require('../../services/contactPage.service')
const { createControllerAction } = require('../../factories/singletonContent.factory')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => contactPageService.getClientContactPage(getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving contact page content:',
  errorMessage: 'Failed to retrieve contact page content'
})
