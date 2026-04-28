const logger = require('../../../../config/logger')
const { getToolByName } = require('./toolRegistry')
const { toolExecutors } = require('./tools/toolExecutors')

/**
 * Thực thi một tool call từ AI response
 * @param {string} toolName - Tên hàm
 * @param {Object} args - Tham số (đã parse từ JSON)
 * @returns {string} Kết quả dạng JSON string
 */
async function executeTool(toolName, args, context = {}) {
  const executor = toolExecutors[toolName]
  const toolMeta = getToolByName(toolName)
  if (!executor) {
    logger.warn(`[AI Tool] Unknown tool: ${toolName}`)
    return JSON.stringify({ error: `Không tìm thấy công cụ "${toolName}".` })
  }

  if (toolMeta?.requiresConfirmation && args?.confirmed !== true) {
    return JSON.stringify({
      success: false,
      confirmationRequired: true,
      message: toolMeta.confirmationMessage
        || `Cong cu ${toolMeta.label || toolName} can xac nhan ro rang truoc khi thuc hien.`
    })
  }

  logger.info(`[AI Tool] Executing: ${toolName}(${JSON.stringify(args)})`)
  const startTime = Date.now()
  const result = await executor(args || {}, context)
  const elapsed = Date.now() - startTime
  logger.info(`[AI Tool] ${toolName} completed in ${elapsed}ms`)

  return result
}

module.exports = {
  executeTool
}
