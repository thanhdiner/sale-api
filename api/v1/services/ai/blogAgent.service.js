const logger = require('../../../../config/logger')
const { getClient, getActiveConfig } = require('./ai.config')
const { getBlogToolDefinitions } = require('../../ai/blog-tools/definitions')
const { getBlogToolRegistry } = require('../../ai/blog-tools/registry')
const BlogAgentLog = require('../../models/blogAgentLog.model')

const BLOG_AGENT_SYSTEM_PROMPT = `
Ban la Blog SEO Agent cho website ban tai khoan so, phan mem ban quyen va dich vu so.

Nhiem vu:
- Tao bai viet huu ich, trung thuc, de hieu.
- Khong bia chinh sach, gia, bao hanh, cam ket.
- Khong tu tao thong tin san pham neu tool khong cung cap.
- Uu tien noi dung huong dan, so sanh, giai thich, FAQ.
- Bai viet phai co ban tieng Viet va ban tieng Anh khi duoc yeu cau.
- Luon tao SEO title, meta description, tags.
- Luon de xuat san pham lien quan neu phu hop.
- Chi tao draft bang tool createBlogDraft.
- Tuyet doi khong publish.
`

const MAX_BLOG_TOOL_ROUNDS = 6

function parseToolArguments(rawArguments, toolName) {
  try {
    return JSON.parse(rawArguments || '{}')
  } catch (error) {
    throw new Error(`Invalid JSON arguments for ${toolName}: ${error.message}`)
  }
}

function serializeToolResult(result) {
  if (typeof result === 'string') return result
  return JSON.stringify(result)
}

function resolveBlogAgentConfig(overrides = {}) {
  const provider = overrides.provider || process.env.BLOG_AGENT_PROVIDER || '9router'
  const model = overrides.model || process.env.BLOG_AGENT_MODEL || 'cx/gpt-5.4'
  const activeConfig = getActiveConfig({ provider, model })

  return {
    ...activeConfig,
    maxTokens: parseInt(overrides.maxTokens || process.env.BLOG_AGENT_MAX_TOKENS, 10) || 4000,
    temperature: Number.isFinite(Number(overrides.temperature || process.env.BLOG_AGENT_TEMPERATURE))
      ? Number(overrides.temperature || process.env.BLOG_AGENT_TEMPERATURE)
      : 0.7
  }
}

async function logToolCall({ batchId, toolName, status, provider, model, input, output, reason, error, topic, blogPost }) {
  await BlogAgentLog.create({
    batchId,
    action: `tool_call:${toolName}`,
    status,
    provider,
    model,
    input,
    output,
    reason: reason || '',
    error: error || '',
    topic: topic || input?.topic || '',
    blogPost: blogPost || output?.id || null
  })
}

async function executeBlogToolCall({ toolCall, registry, batchId, provider, model, createdDrafts }) {
  const toolName = toolCall.function?.name
  const executor = registry[toolName]
  const args = parseToolArguments(toolCall.function?.arguments, toolName)
  const input = {
    ...args,
    batchId,
    provider,
    model
  }

  if (!executor) {
    await logToolCall({
      batchId,
      toolName,
      status: 'failed',
      provider,
      model,
      input: args,
      reason: `Unknown tool: ${toolName}`
    })

    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  }

  try {
    const output = await executor(input)

    if (toolName === 'createBlogDraft') {
      createdDrafts.push(output)
    }

    await logToolCall({
      batchId,
      toolName,
      status: 'success',
      provider,
      model,
      input: args,
      output,
      topic: args.ai?.topic || args.topic || args.title,
      blogPost: output?.id || null
    })

    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: serializeToolResult(output)
    }
  } catch (error) {
    logger.error(`[BlogAgent] Tool ${toolName} failed:`, error)

    await logToolCall({
      batchId,
      toolName,
      status: 'failed',
      provider,
      model,
      input: args,
      error: error.message,
      topic: args.ai?.topic || args.topic || args.title
    })

    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify({ error: error.message })
    }
  }
}

async function runBlogAgentGenerateDrafts({
  batchId,
  postsPerRun = 5,
  language = 'vi',
  generateEnglish = true,
  provider: providerOverride,
  model: modelOverride,
  maxTokens,
  temperature
}) {
  const { provider, model, maxTokens: resolvedMaxTokens, temperature: resolvedTemperature } = resolveBlogAgentConfig({
    provider: providerOverride,
    model: modelOverride,
    maxTokens,
    temperature
  })
  const client = getClient(provider)
  const tools = getBlogToolDefinitions()
  const registry = getBlogToolRegistry()
  const createdDrafts = []
  const messages = [
    {
      role: 'system',
      content: BLOG_AGENT_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: `
Hay tao ${postsPerRun} bai blog moi cho website.

Yeu cau:
- Chu de dua tren san pham dang noi bat hoac cau hoi khach hang hay hoi.
- Khong trung voi bai gan day.
- Viet tieng Viet.
- language = ${language}
- generateEnglish = ${generateEnglish}
- Neu generateEnglish = true, tao translations.en day du.
- Tao SEO title, SEO description, SEO keywords.
- Goi y category phu hop neu co du lieu.
- Goi y related products neu phu hop.
- Moi bai hop le phai duoc luu bang tool createBlogDraft.
- batchId = ${batchId}
`
    }
  ]

  for (let round = 0; round < MAX_BLOG_TOOL_ROUNDS; round += 1) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: resolvedMaxTokens,
      temperature: resolvedTemperature
    })

    const assistantMessage = response.choices?.[0]?.message
    if (!assistantMessage) break

    const toolCalls = assistantMessage.tool_calls || []
    if (toolCalls.length === 0) {
      messages.push(assistantMessage)
      break
    }

    messages.push(assistantMessage)

    const toolResults = []
    for (const toolCall of toolCalls) {
      const toolResult = await executeBlogToolCall({
        toolCall,
        registry,
        batchId,
        provider,
        model,
        createdDrafts
      })
      toolResults.push(toolResult)
    }

    messages.push(...toolResults)

    if (createdDrafts.length >= postsPerRun) break
  }

  return {
    batchId,
    createdCount: createdDrafts.length,
    drafts: createdDrafts
  }
}

module.exports = {
  runBlogAgentGenerateDrafts
}
