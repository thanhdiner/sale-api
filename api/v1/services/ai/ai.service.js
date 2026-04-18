/**
 * AI Service — Core chatbot service (với Function Calling / Tool Calling)
 * Hỗ trợ đa provider: OpenAI, DeepSeek, Groq
 * Bot có thể tự truy vấn DB (sản phẩm, đơn hàng, khuyến mãi) để trả lời khách
 */

const OpenAI = require('openai')
const logger = require('../../../../config/logger')
const { buildSystemPrompt, buildMessages } = require('./prompt.builder')
const conversationMemory = require('./conversation.memory')
const { toolDefinitions, executeTool } = require('./ai.tools')

// ─── Provider configuration ─────────────────────────────────────────────────
const PROVIDERS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini'
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat'
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile'
  }
}

// Cached client instances
const _clients = {}

// Giới hạn số vòng tool calling tối đa (tránh loop vô hạn)
const MAX_TOOL_ROUNDS = 3

/**
 * Lấy hoặc tạo OpenAI client cho provider
 */
function getClient(provider) {
  if (_clients[provider]) return _clients[provider]

  const config = PROVIDERS[provider]
  if (!config) {
    throw new Error(`[AI] Unknown provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(', ')}`)
  }

  const apiKey = process.env[config.envKey]
  if (!apiKey) {
    throw new Error(`[AI] Missing API key: ${config.envKey}`)
  }

  _clients[provider] = new OpenAI({
    apiKey,
    baseURL: config.baseURL
  })

  logger.info(`[AI] Initialized ${provider} client (baseURL: ${config.baseURL})`)
  return _clients[provider]
}

/**
 * Lấy provider và model hiện tại từ env
 */
function getActiveConfig() {
  const provider = (process.env.CHATBOT_PROVIDER || 'openai').toLowerCase()
  const config = PROVIDERS[provider]
  if (!config) {
    logger.warn(`[AI] Invalid provider "${provider}", falling back to openai`)
    return { provider: 'openai', model: PROVIDERS.openai.defaultModel }
  }

  const model = process.env.CHATBOT_MODEL || config.defaultModel
  return { provider, model }
}

// ─── Fallback message ────────────────────────────────────────────────────────
const FALLBACK_MESSAGE = process.env.CHATBOT_FALLBACK_MESSAGE
  || 'Xin lỗi, mình gặp chút trục trặc. Để mình chuyển bạn đến nhân viên hỗ trợ nhé! 🙏'

// Keywords that trigger auto-escalation to human agent
const ESCALATE_KEYWORDS = [
  'gặp nhân viên', 'nói chuyện với người', 'chuyển nhân viên',
  'hotline', 'khiếu nại', 'kiện', 'tố cáo'
]

/**
 * Xử lý message từ khách hàng và trả về bot reply
 * Hỗ trợ Function Calling: Bot tự quyết định khi nào cần tra DB
 *
 * @param {string} sessionId - ID phiên chat
 * @param {string} userMessage - Tin nhắn từ khách
 * @param {Object} customerInfo - { name, userId, currentPage }
 * @returns {Object|null} { text, suggestions, escalate, escalateReason, metadata }
 */
async function processMessage(sessionId, userMessage, customerInfo = {}) {
  try {
    // ── Check escalation keywords ──────────────────────────────────────
    const lowerMsg = userMessage.toLowerCase()
    const matchedKeyword = ESCALATE_KEYWORDS.find(kw => lowerMsg.includes(kw))
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

    // ── Lấy config ─────────────────────────────────────────────────────
    const { provider, model } = getActiveConfig()
    const client = getClient(provider)

    const maxTokens = parseInt(process.env.CHATBOT_MAX_TOKENS) || 1000
    const temperature = parseFloat(process.env.CHATBOT_TEMPERATURE) || 0.7

    // ── Build prompt & context ─────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({ customerInfo })
    const history = await conversationMemory.getContext(sessionId)
    const messages = buildMessages(systemPrompt, history, userMessage)

    // ── Gọi AI API với Function Calling ────────────────────────────────
    logger.info(`[AI] Calling ${provider}/${model} for session ${sessionId} (${messages.length} messages, tools: ${toolDefinitions.length})`)

    const startTime = Date.now()
    let totalTokens = 0
    let toolsUsed = []
    let reply = null

    // ── Tool Calling Loop ──────────────────────────────────────────────
    // Bot có thể gọi tool nhiều lần (VD: tìm SP rồi lấy chi tiết)
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const requestParams = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }

      // Chỉ gửi tools nếu chưa phải vòng cuối
      if (round < MAX_TOOL_ROUNDS - 1) {
        requestParams.tools = toolDefinitions
        requestParams.tool_choice = 'auto'
      }

      let response
      try {
        response = await client.chat.completions.create(requestParams)
      } catch (apiErr) {
        // ── Groq/Llama fallback: parse failed_generation XML ────────
        // Llama models sometimes generate XML-style tool calls like
        // <function=searchProducts{"keyword":"laptop"}</function>
        // which Groq rejects with tool_use_failed error
        if (apiErr.error?.code === 'tool_use_failed' && apiErr.error?.failed_generation) {
          const parsed = parseFailedGeneration(apiErr.error.failed_generation)
          if (parsed) {
            logger.info(`[AI] Groq fallback: parsed failed_generation → ${parsed.name}(${JSON.stringify(parsed.args)})`)
            toolsUsed.push(parsed.name)
            const toolResult = await executeTool(parsed.name, parsed.args)

            // Gọi lại AI KHÔNG có tools, kèm dữ liệu từ DB
            messages.push({
              role: 'assistant',
              content: `Tôi đã tra cứu hệ thống và có kết quả sau: ${toolResult}`
            })

            const followUp = await client.chat.completions.create({
              model,
              messages,
              max_tokens: maxTokens,
              temperature,
            })
            totalTokens += followUp.usage?.total_tokens || 0
            reply = followUp.choices?.[0]?.message?.content
            break
          }
        }
        // Nếu không parse được → throw lại để catch bên ngoài xử lý
        throw apiErr
      }

      totalTokens += response.usage?.total_tokens || 0

      const choice = response.choices?.[0]
      if (!choice) break

      const assistantMessage = choice.message

      // ── Nếu AI trả về tool_calls → thực thi và quay lại ──────────
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        logger.info(`[AI] Round ${round + 1}: Bot requested ${assistantMessage.tool_calls.length} tool(s)`)

        // Push assistant message (chứa tool_calls) vào messages
        messages.push(assistantMessage)

        // Thực thi từng tool call song song
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
            const result = await executeTool(toolName, args)

            return {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result
            }
          })
        )

        // Push tất cả tool results vào messages
        messages.push(...toolResults)

        // Tiếp tục vòng lặp → gọi AI lại với dữ liệu từ DB
        continue
      }

      // ── Nếu AI trả về text bình thường → hoàn tất ────────────────
      reply = assistantMessage.content
      break
    }

    const elapsed = Date.now() - startTime

    if (!reply) {
      logger.warn(`[AI] Empty response from ${provider} after tool loop (${elapsed}ms)`)
      return { text: FALLBACK_MESSAGE, escalate: true, escalateReason: 'AI returned empty response' }
    }

    logger.info(`[AI] Response from ${provider} (${elapsed}ms, ${totalTokens} tokens, tools: [${toolsUsed.join(', ')}])`)

    // ── Cập nhật conversation memory ───────────────────────────────────
    await conversationMemory.addMessage(sessionId, 'user', userMessage)
    await conversationMemory.addMessage(sessionId, 'assistant', reply)

    // ── Parse suggestions từ response ──────────────────────────────────
    const suggestions = extractSuggestions(reply)
    const cleanedReply = removeSuggestionLines(reply)

    return {
      text: cleanedReply,
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

    // Differentiate API errors
    if (err.status === 429) {
      return {
        text: 'Mình đang bận quá, bạn đợi mình một chút nhé! ⏳',
        escalate: false,
        suggestions: ['Thử lại sau', 'Chuyển nhân viên'],
        metadata: { error: 'rate_limit' }
      }
    }

    return {
      text: FALLBACK_MESSAGE,
      escalate: true,
      escalateReason: `AI error: ${err.message}`,
      suggestions: [],
      metadata: { error: err.message }
    }
  }
}

/**
 * Parse Groq failed_generation XML format
 * Groq/Llama sometimes generates: <function=searchProducts{"keyword":"laptop"}</function>
 * or: <function=searchProducts {"keyword": "laptop"} </function>
 * @param {string} text - The failed_generation string from Groq error
 * @returns {Object|null} { name, args } or null if can't parse
 */
function parseFailedGeneration(text) {
  try {
    // Match patterns like:
    // <function=toolName{"keyword":"laptop"}</function>
    // <function=toolName {"keyword": "laptop"} </function>
    // <function=toolName{"keyword": "laptop"}></function>
    const match = text.match(/<function=(\w+)\s*(\{.*?\})\s*>?\s*<\/function>/s)
    if (!match) {
      logger.warn(`[AI] Could not parse failed_generation: ${text}`)
      return null
    }

    const name = match[1]
    let args = {}
    try {
      args = JSON.parse(match[2])
    } catch {
      // Sometimes args have trailing spaces or invalid JSON
      // Try cleaning up
      const cleanJson = match[2].replace(/'/g, '"').trim()
      args = JSON.parse(cleanJson)
    }

    return { name, args }
  } catch (err) {
    logger.warn(`[AI] parseFailedGeneration error: ${err.message}`)
    return null
  }
}

/**
 * Trích xuất suggestion chips từ AI response
 * Bot được instruct gợi ý cuối câu trả lời dạng "- Gợi ý: ..."
 */
function extractSuggestions(text) {
  const suggestions = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Match patterns like: "• Gợi ý", "- Câu hỏi:", bullet suggestions
    if (/^[-•►▸]\s/.test(trimmed) && trimmed.length < 60 && trimmed.length > 3) {
      const clean = trimmed.replace(/^[-•►▸]\s*/, '').trim()
      if (clean && !clean.endsWith(':')) {
        suggestions.push(clean)
      }
    }
  }

  // Chỉ lấy max 3 suggestions từ cuối response
  return suggestions.slice(-3)
}

/**
 * Xóa dòng suggestion từ response text (đã trích ra chips rồi)
 */
function removeSuggestionLines(text) {
  const lines = text.split('\n')
  const suggestions = []
  const contentLines = []

  // Tìm block suggestion cuối cùng
  let inSuggestionBlock = false
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim()
    if (/^[-•►▸]\s/.test(trimmed) && trimmed.length < 60) {
      inSuggestionBlock = true
      suggestions.unshift(i)
    } else if (inSuggestionBlock) {
      // Nếu dòng trước suggestion block là label thì bỏ luôn
      if (/gợi ý|bạn có thể hỏi|câu hỏi/i.test(trimmed)) {
        suggestions.unshift(i)
      }
      break
    } else {
      break
    }
  }

  // Nếu có suggestion block → remove
  if (suggestions.length > 0) {
    const removeSet = new Set(suggestions)
    for (let i = 0; i < lines.length; i++) {
      if (!removeSet.has(i)) {
        contentLines.push(lines[i])
      }
    }
    return contentLines.join('\n').trim()
  }

  return text.trim()
}

module.exports = {
  processMessage,
  getActiveConfig
}
