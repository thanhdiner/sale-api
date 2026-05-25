const OpenAI = require('openai')
const axios = require('axios')

function normalizeHeaders(headers = {}) {
  if (!headers) return {}
  if (headers instanceof Map) return Object.fromEntries(headers)
  return { ...headers }
}

function makeOpenAIClient({ apiKey, baseURL, timeoutMs, maxRetries, headers }) {
  return new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries, defaultHeaders: normalizeHeaders(headers) })
}

function normalizeTools(tools = []) {
  return tools.map(tool => ({
    name: tool.function?.name || tool.name,
    description: tool.function?.description || tool.description || '',
    input_schema: tool.function?.parameters || tool.input_schema || { type: 'object', properties: {} }
  })).filter(tool => tool.name)
}

function toAnthropicMessages(messages = []) {
  const system = messages.find(message => message.role === 'system')?.content || ''
  const rest = messages.filter(message => message.role !== 'system').map(message => {
    if (message.role === 'tool') {
      return { role: 'user', content: `Tool result: ${message.content}` }
    }

    return {
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content || '')
    }
  })

  return { system, messages: rest }
}

function fromAnthropicResponse(data = {}) {
  const toolUse = Array.isArray(data.content) ? data.content.find(item => item.type === 'tool_use') : null
  const text = Array.isArray(data.content)
    ? data.content.filter(item => item.type === 'text').map(item => item.text).join('\n')
    : ''

  return {
    choices: [{
      message: toolUse
        ? { role: 'assistant', content: text || null, tool_calls: [{ id: toolUse.id, type: 'function', function: { name: toolUse.name, arguments: JSON.stringify(toolUse.input || {}) } }] }
        : { role: 'assistant', content: text }
    }],
    usage: { total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) }
  }
}

function makeAnthropicClient({ apiKey, baseURL, timeoutMs, headers }) {
  const customHeaders = normalizeHeaders(headers)

  return {
    chat: {
      completions: {
        create: async params => {
          const converted = toAnthropicMessages(params.messages)
          const response = await axios.post(`${String(baseURL).replace(/\/$/, '')}/messages`, {
            model: params.model,
            system: converted.system || undefined,
            messages: converted.messages,
            tools: params.tools?.length ? normalizeTools(params.tools) : undefined,
            max_tokens: params.max_tokens,
            temperature: params.temperature
          }, {
            timeout: timeoutMs,
            headers: { ...customHeaders, 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
          })

          return fromAnthropicResponse(response.data)
        }
      }
    }
  }
}

function toGeminiContents(messages = []) {
  return messages.filter(message => message.role !== 'system').map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content || '') }]
  }))
}

function fromGeminiResponse(data = {}) {
  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts || []
  const fn = parts.find(part => part.functionCall)?.functionCall
  const text = parts.filter(part => part.text).map(part => part.text).join('\n')

  return {
    choices: [{
      message: fn
        ? { role: 'assistant', content: text || null, tool_calls: [{ id: `call_${Date.now()}`, type: 'function', function: { name: fn.name, arguments: JSON.stringify(fn.args || {}) } }] }
        : { role: 'assistant', content: text }
    }],
    usage: { total_tokens: data.usageMetadata?.totalTokenCount || 0 }
  }
}

function makeGeminiClient({ apiKey, baseURL, timeoutMs, headers }) {
  const customHeaders = normalizeHeaders(headers)

  return {
    chat: {
      completions: {
        create: async params => {
          const system = params.messages?.find(message => message.role === 'system')?.content
          const response = await axios.post(`${String(baseURL).replace(/\/$/, '')}/models/${params.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            contents: toGeminiContents(params.messages),
            generationConfig: { maxOutputTokens: params.max_tokens, temperature: params.temperature },
            tools: params.tools?.length ? [{ functionDeclarations: params.tools.map(tool => ({
              name: tool.function?.name,
              description: tool.function?.description,
              parameters: tool.function?.parameters
            })) }] : undefined
          }, { timeout: timeoutMs, headers: customHeaders })

          return fromGeminiResponse(response.data)
        }
      }
    }
  }
}

function makeCustomHttpClient({ apiKey, baseURL, timeoutMs, headers }) {
  const customHeaders = normalizeHeaders(headers)

  return {
    chat: {
      completions: {
        create: async params => {
          const response = await axios.post(baseURL, params, {
            timeout: timeoutMs,
            headers: { ...customHeaders, authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }
          })
          return response.data
        }
      }
    }
  }
}

function createAIClient(config = {}) {
  if (config.adapter === 'anthropic-compatible') return makeAnthropicClient(config)
  if (config.adapter === 'gemini-compatible') return makeGeminiClient(config)
  if (config.adapter === 'custom-http') return makeCustomHttpClient(config)
  return makeOpenAIClient(config)
}

async function listAdapterModels(config = {}) {
  if (config.adapter !== 'openai-compatible') return []

  const baseURL = String(config.baseURL || '').replace(/\/$/, '')
  if (!baseURL) return []

  const response = await axios.get(`${baseURL}/models`, {
    timeout: config.timeoutMs,
    headers: {
      ...normalizeHeaders(config.headers),
      authorization: `Bearer ${config.apiKey}`
    }
  })

  return (response.data?.data || [])
    .map(model => model?.id || model?.model)
    .filter(Boolean)
}

async function testAdapter(config = {}) {
  const client = createAIClient(config)
  return client.chat.completions.create({
    model: config.model,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 8,
    temperature: 0
  })
}

module.exports = {
  createAIClient,
  listAdapterModels,
  testAdapter
}
