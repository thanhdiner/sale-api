const comingSoonContentService = require('../../../services/shared/cms/comingSoonContent.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => comingSoonContentService.getClientComingSoonContent(req.params.key, getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving coming soon content:',
  errorMessage: 'Failed to retrieve coming soon content',
  handleKnownErrors: true
})










