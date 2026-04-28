const logger = require('../../../../config/logger')
const { executeTool, getToolByName } = require('./ai.tools')
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
  const durationMs = Date.now() - toolStartedAt

  await recordToolCall({
    conversationId: customerInfo.conversationId,
    sessionId,
    userId: customerInfo.userId,
    triggerMessage: promptText,
    toolName,
    toolArgs: args,
    result,
    durationMs,
    provider,
    model,
    round
  })

  return { result, durationMs }
}

function buildToolActivity({ toolName, durationMs, round }) {
  const toolMeta = getToolByName(toolName)

  return {
    type: 'tool',
    status: 'done',
    toolName,
    toolLabel: toolMeta?.label || toolName,
    durationMs,
    round
  }
}

function parseToolResult(result) {
  if (typeof result !== 'string') return null

  try {
    return JSON.parse(result)
  } catch {
    return null
  }
}

function getHandoffRequestFromToolResult({ toolName, args, result }) {
  const payload = parseToolResult(result)
  if (!payload?.handoffRequested && !payload?.escalate) return null

  return {
    toolName,
    reason: payload.escalationReason || payload.reason || args?.reason || 'AI requested human support',
    priority: payload.priority || args?.priority || 'normal',
    summary: payload.summary || args?.summary || null,
    message: payload.message || 'Minh da chuyen cuoc tro chuyen sang nhan vien ho tro. Ban vui long doi trong giay lat nhe.'
  }
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
  promptText,
  onActivity
}) {
  let totalTokens = 0
  const toolsUsed = []
  const agentActivity = []
  let reply = null
  let handoffRequest = null
  const toolContext = {
    sessionId,
    customerInfo,
    promptText,
    userId: customerInfo.userId || null
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const requestParams = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    }

    if (!handoffRequest && round < MAX_TOOL_ROUNDS - 1 && toolDefinitions.length > 0) {
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
          const parsedToolMeta = getToolByName(parsed.name)

          if (typeof onActivity === 'function') {
            onActivity({
              type: 'tool',
              status: 'running',
              toolName: parsed.name,
              toolLabel: parsedToolMeta?.label || parsed.name,
              round: round + 1
            })
          }

          const toolExecution = await executeToolAndLog({
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
          const parsedHandoffRequest = getHandoffRequestFromToolResult({
            toolName: parsed.name,
            args: parsed.args,
            result: toolExecution.result
          })
          if (parsedHandoffRequest) handoffRequest = parsedHandoffRequest

          const parsedActivity = buildToolActivity({
            toolName: parsed.name,
            durationMs: toolExecution.durationMs,
            round: round + 1
          })
          agentActivity.push(parsedActivity)
          if (typeof onActivity === 'function') onActivity(parsedActivity)

          messages.push({
            role: 'assistant',
            content: `Tool result from ${parsed.name}: ${toolExecution.result}`
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
          const toolMeta = getToolByName(toolName)

          if (typeof onActivity === 'function') {
            onActivity({
              type: 'tool',
              status: 'running',
              toolName,
              toolLabel: toolMeta?.label || toolName,
              round: round + 1
            })
          }

          const toolExecution = await executeToolAndLog({
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
          const toolHandoffRequest = getHandoffRequestFromToolResult({
            toolName,
            args,
            result: toolExecution.result
          })
          if (toolHandoffRequest) handoffRequest = toolHandoffRequest

          const toolActivity = buildToolActivity({
            toolName,
            durationMs: toolExecution.durationMs,
            round: round + 1
          })
          agentActivity.push(toolActivity)
          if (typeof onActivity === 'function') onActivity(toolActivity)

          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolExecution.result
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
    toolsUsed,
    agentActivity,
    handoffRequest
  }
}

module.exports = {
  generateReplyWithTools
}
