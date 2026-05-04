const { getClient, getRuntimeConfig } = require('./ai.config')

const TARGETS = new Set(['blog_category', 'blog_tag', 'blog_post'])

function extractJson(content) {
  const text = String(content || '').trim()
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI response is not valid JSON')
    return JSON.parse(match[0])
  }
}

function buildSchema(target) {
  if (target === 'blog_category') {
    return { name: 'string', description: 'string' }
  }
  if (target === 'blog_tag') {
    return { name: 'string' }
  }
  return {
    title: 'string',
    excerpt: 'string',
    content: 'HTML string',
    category: 'string',
    tags: ['string']
  }
}

async function translateContentToEnglish({ target, payload = {}, provider, model, maxTokens, temperature }) {
  if (!TARGETS.has(target)) throw new Error(`Unsupported translation target: ${target}`)

  const config = await getRuntimeConfig({ provider, model, maxTokens, temperature })
  const client = getClient(config.provider)

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: 'You translate Vietnamese admin CMS content to natural English. Return only valid JSON. Preserve HTML tags and structure. Do not add facts, prices, warranties, policies, claims, or marketing promises not present in the input.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'translate_admin_cms_content_to_english',
          target,
          outputSchema: buildSchema(target),
          input: payload
        })
      }
    ],
    max_tokens: Number.isFinite(Number(config.maxTokens)) ? config.maxTokens : 1200,
    temperature: Number.isFinite(Number(config.temperature)) ? Math.min(config.temperature, 0.4) : 0.2,
    response_format: { type: 'json_object' }
  })

  return {
    provider: config.provider,
    model: config.model,
    result: extractJson(response.choices?.[0]?.message?.content)
  }
}

module.exports = { translateContentToEnglish }
