const logger = require('../../../../config/logger')
const { executeTool } = require('./ai.tools')
const { recordToolCall } = require('./toolCallLogger')
const { parseFailedGeneration } = require('./ai.helpers')
const { MAX_TOOL_ROUNDS } = require('./ai.constants')

async function executeToolAndLog({
  toolName,
  args,
  toolContext,
  customerInfo,
  promptText,
  provider,
  model,
  round,
  sessionId
}) {
  const toolStartedAt = Date.now()
  const result = await executeTool(toolName, args, toolContext)

  await recordToolCall({
    conversationId: customerInfo.conversationId,
    sessionId,
    userId: customerInfo.userId,
    triggerMessage: promptText,
    toolName,
    toolArgs: args,
    result,
    durationMs: Date.now() - toolStartedAt,
    provider,
    model,
    round
  })

  return result
}

async function generateReplyWithTools({
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
}) {
  let totalTokens = 0
  const toolsUsed = []
  let reply = null
  const toolContext = {
    sessionId,
    customerInfo,
    userId: customerInfo.userId || null
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const requestParams = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    }

    if (round < MAX_TOOL_ROUNDS - 1 && toolDefinitions.length > 0) {
      requestParams.tools = toolDefinitions
      requestParams.tool_choice = 'auto'
    }

    let response

    try {
      response = await client.chat.completions.create(requestParams)
    } catch (apiErr) {
      if (apiErr.error?.code === 'tool_use_failed' && apiErr.error?.failed_generation) {
        const parsed = parseFailedGeneration(apiErr.error.failed_generation)

        if (parsed) {
          logger.info(`[AI] Groq fallback: parsed failed_generation -> ${parsed.name}(${JSON.stringify(parsed.args)})`)
          toolsUsed.push(parsed.name)

          const toolResult = await executeToolAndLog({
            toolName: parsed.name,
            args: parsed.args,
            toolContext,
            customerInfo,
            promptText,
            provider,
            model,
            round: round + 1,
            sessionId
          })

          messages.push({
            role: 'assistant',
            content: `Tôi đã tra cứu hệ thống và có kết quả sau: ${toolResult}`
          })

          const followUp = await client.chat.completions.create({
            model,
            messages,
            max_tokens: maxTokens,
            temperature
          })

          totalTokens += followUp.usage?.total_tokens || 0
          reply = followUp.choices?.[0]?.message?.content
          break
        }
      }

      throw apiErr
    }

    totalTokens += response.usage?.total_tokens || 0

    const assistantMessage = response.choices?.[0]?.message
    if (!assistantMessage) break

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      logger.info(`[AI] Round ${round + 1}: Bot requested ${assistantMessage.tool_calls.length} tool(s)`)
      messages.push(assistantMessage)

      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall) => {
          const toolName = toolCall.function.name
          let args = {}

          try {
            args = JSON.parse(toolCall.function.arguments || '{}')
          } catch (parseErr) {
            logger.warn(`[AI] Failed to parse tool args for ${toolName}:`, parseErr.message)
          }

          toolsUsed.push(toolName)

          const result = await executeToolAndLog({
            toolName,
            args,
            toolContext,
            customerInfo,
            promptText,
            provider,
            model,
            round: round + 1,
            sessionId
          })

          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result
          }
        })
      )

      messages.push(...toolResults)
      continue
    }

    reply = assistantMessage.content
    break
  }

  return {
    reply,
    totalTokens,
    toolsUsed
  }
}

module.exports = {
  generateReplyWithTools
}
