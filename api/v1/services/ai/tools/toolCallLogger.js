const agentToolCallRepository = require('../../../repositories/chatbot/agentToolCall.repository')
const logger = require('../../../../../config/logger')
const { getToolByName } = require('./ai.tools')

function truncate(value, maxLength = 4000) {
  if (value == null) return ''
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
  return stringValue.length > maxLength
    ? `${stringValue.slice(0, maxLength - 3)}...`
    : stringValue
}

function parseOutcome(result) {
  if (typeof result !== 'string') return 'success'

  try {
    const parsed = JSON.parse(result)
    if (parsed?.error) return 'error'
    if (parsed?.found === false) return 'not_found'
    return 'success'
  } catch {
    return 'success'
  }
}

function getResultPreview(result) {
  if (typeof result !== 'string') return truncate(result, 280)

  try {
    const parsed = JSON.parse(result)
    const previewSource =
      parsed?.escalationReason
      || parsed?.reason
      || parsed?.message
      || parsed?.error
      || parsed?.suggestion
      || parsed?.product?.name
      || parsed?.order?.status
      || parsed?.category
      || parsed?.count
      || result

    return truncate(previewSource, 280)
  } catch {
    return truncate(result, 280)
  }
}

async function recordToolCall(payload = {}) {
  try {
    if (!payload.sessionId || String(payload.sessionId).startsWith('test_')) {
      return
    }

    const toolMeta = getToolByName(payload.toolName)

    await agentToolCallRepository.create({
      conversationId: payload.conversationId || null,
      sessionId: payload.sessionId,
      userId: payload.userId || null,
      toolName: payload.toolName,
      toolLabel: toolMeta?.label || payload.toolName,
      toolArgs: payload.toolArgs || {},
      triggerMessage: truncate(payload.triggerMessage, 2000),
      resultPreview: getResultPreview(payload.result),
      resultPayload: truncate(payload.result, 4000),
      outcome: payload.outcome || parseOutcome(payload.result),
      durationMs: payload.durationMs || 0,
      provider: payload.provider || null,
      model: payload.model || null,
      round: payload.round || 1
    })
  } catch (err) {
    logger.warn(`[AI Tool] Failed to persist tool log: ${err.message}`)
  }
}

module.exports = {
  recordToolCall
}












