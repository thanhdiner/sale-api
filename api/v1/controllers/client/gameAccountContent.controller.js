const gameAccountContentService = require('../../services/gameAccountContent.service')
const { createControllerAction } = require('../../factories/singletonContent.factory')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = createControllerAction({
  handler: req => gameAccountContentService.getClientGameAccountContent(getRequestLanguage(req)),
  logMessage: '[Client] Error retrieving game account content:',
  errorMessage: 'Failed to retrieve game account content'
})
