/**
 * AI Service - Core chatbot entrypoint.
 * Keep public API stable while moving internals into smaller modules.
 */

const logger = require('../../../../config/logger')
const { buildSystemPrompt, buildMessages } = require('./prompt.builder')
const conversationMemory = require('./conversation.memory')
const { getToolDefinitions } = require('./ai.tools')
const { PROCESS_FALLBACK_MESSAGE } = require('./ai.constants')
const { getClient, getActiveConfig, getRuntimeConfig } = require('./ai.config')
const {
  extractTextFromContent,
  normalizeUserMessage,
  extractSuggestions,
  removeSuggestionLines
} = require('./ai.helpers')
const { generateReplyWithTools } = require('./ai.completion')

async function processMessage(sessionId, userMessage, customerInfo = {}, overrides = {}) {
  let fallbackMessage = PROCESS_FALLBACK_MESSAGE

  try {
    const { promptInput, promptText, memoryInput } = normalizeUserMessage(userMessage)
    const runtimeConfig = await getRuntimeConfig(overrides)
    const {
      provider,
      model,
      maxTokens,
      temperature,
      autoEscalateKeywords,
      systemPromptOverride,
      brandVoice,
      agentName,
      agentRole,
      agentTone,
      systemRules,
      toolSettings,
      availableTools
    } = runtimeConfig
    const toolDefinitions = getToolDefinitions(toolSettings)

    fallbackMessage = runtimeConfig.fallbackMessage || PROCESS_FALLBACK_MESSAGE

    const lowerMsg = String(promptText || extractTextFromContent(promptInput) || '').toLowerCase()
    const matchedKeyword = autoEscalateKeywords.find(keyword =>
      lowerMsg.includes(String(keyword).toLowerCase())
    )

    if (matchedKeyword) {
      logger.info(`[AI] Escalation keyword detected: "${matchedKeyword}" (session: ${sessionId})`)
      return {
        text: 'Mình sẽ chuyển bạn đến nhân viên hỗ trợ ngay nhé! Vui lòng đợi trong giây lát 🙏',
        escalate: true,
        escalateReason: `Khách yêu cầu: "${matchedKeyword}"`,
        suggestions: [],
        metadata: { intent: 'escalate', keyword: matchedKeyword }
      }
    }

    const client = getClient(provider)
    const systemPrompt = buildSystemPrompt({
      customerInfo,
      customPrompt: systemPromptOverride,
      brandVoice,
      agentName,
      agentRole,
      agentTone,
      systemRules,
      availableTools
    })
    const history = await conversationMemory.getContext(sessionId)
    const messages = buildMessages(systemPrompt, history, promptInput)

    logger.info(
      `[AI] Calling ${provider}/${model} for session ${sessionId} `
      + `(${messages.length} messages, tools: ${toolDefinitions.length})`
    )

    const startTime = Date.now()
    const { reply, totalTokens, toolsUsed } = await generateReplyWithTools({
      client,
      messages,
      toolDefinitions,
      provider,
      model,
      maxTokens,
      temperature,
      sessionId,
      customerInfo,
      promptText
    })
    const elapsed = Date.now() - startTime

    if (!reply) {
      logger.warn(`[AI] Empty response from ${provider} after tool loop (${elapsed}ms)`)
      return {
        text: fallbackMessage,
        escalate: true,
        escalateReason: 'AI returned empty response'
      }
    }

    logger.info(`[AI] Response from ${provider} (${elapsed}ms, ${totalTokens} tokens, tools: [${toolsUsed.join(', ')}])`)

    await conversationMemory.addMessage(sessionId, 'user', memoryInput)
    await conversationMemory.addMessage(sessionId, 'assistant', reply)

    const suggestions = extractSuggestions(reply)

    return {
      text: removeSuggestionLines(reply),
      suggestions,
      escalate: false,
      escalateReason: null,
      metadata: {
        provider,
        model,
        tokensUsed: totalTokens,
        responseTime: elapsed,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
      }
    }
  } catch (err) {
    logger.error(`[AI] processMessage error (session: ${sessionId}): ${err.message || err}`)
    if (err.stack) logger.error(`[AI] Stack: ${err.stack}`)
    if (err.error) logger.error(`[AI] API Error body: ${JSON.stringify(err.error)}`)

    if (err.status === 429) {
      return {
        text: 'Mình đang bận quá, bạn đợi mình một chút nhé! ⏳',
        escalate: false,
        suggestions: ['Thử lại sau', 'Chuyển nhân viên'],
        metadata: { error: 'rate_limit' }
      }
    }

    return {
      text: fallbackMessage,
      escalate: true,
      escalateReason: `AI error: ${err.message}`,
      suggestions: [],
      metadata: { error: err.message }
    }
  }
}

module.exports = {
  processMessage,
  getActiveConfig,
  getRuntimeConfig
}
