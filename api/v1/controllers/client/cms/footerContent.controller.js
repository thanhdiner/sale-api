const footerContentService = require('../../../services/shared/cms/footerContent.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => footerContentService.getClientFooterContent(getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving footer content:',
  errorMessage: 'Failed to retrieve footer content'
})










