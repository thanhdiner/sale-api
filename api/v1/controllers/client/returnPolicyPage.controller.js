const logger = require('../../../../config/logger')
const returnPolicyPageService = require('../../services/returnPolicyPage.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = async (req, res) => {
  try {
    const result = await returnPolicyPageService.getClientReturnPolicyPage(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Client] Error retrieving return policy page content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve return policy page content' })
  }
}
