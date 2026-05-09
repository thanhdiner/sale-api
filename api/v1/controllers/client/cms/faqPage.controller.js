const faqPageService = require('../../../services/shared/cms/faqPage.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => faqPageService.getClientFaqPage(getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving FAQ page content:',
  errorMessage: 'Failed to retrieve FAQ page content'
})










