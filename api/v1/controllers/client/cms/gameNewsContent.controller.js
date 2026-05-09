const gameNewsContentService = require('../../../services/shared/cms/gameNewsContent.service')
const { createControllerAction } = require('../../../factories/singletonContent.factory')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => gameNewsContentService.getClientGameNewsContent(getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving game news content:',
  errorMessage: 'Failed to retrieve game news content'
})










