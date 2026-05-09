const { getClient, getRuntimeConfig } = require('../core/ai.config')

const ACTIONS = ['suggest', 'improve', 'complete', 'generate_all']
const TARGETS = [
  'title',
  'features',
  'description',
  'content',
  'deliveryInstructions',
  'translations.en.title',
  'translations.en.features',
  'translations.en.description',
  'translations.en.content',
  'translations.en.deliveryInstructions',
  'all'
]

const SYSTEM_PROMPT = `
Ban la tro ly viet noi dung san pham cho trang admin cua website ban tai khoan so, phan mem ban quyen va dich vu so.

Nguyen tac bat buoc:
- Chi tra ve JSON hop le, khong markdown, khong giai thich.
- Khong tu bia gia, bao hanh, ton kho, giam gia, chinh sach, cam ket hoan tien hoac thoi gian giao hang neu input khong co.
- Noi dung phai trung thuc, ro rang, huu ich va phu hop ban hang online.
- Truong description/content phai la HTML fragment an toàn cho rich text editor.
- Truong features phai la mang chuoi ngan gon.
- Truong translations.en.* phai viet tieng Anh tu nhien.
- Truong goc khong nam trong translations phai viet tieng Viet.
`

function isAllowedAction(action) {
  return ACTIONS.includes(action)
}

function isAllowedTarget(target) {
  return TARGETS.includes(target)
}

async function resolveConfig(overrides = {}) {
  const runtimeConfig = await getRuntimeConfig({
    provider: overrides.provider || process.env.PRODUCT_CONTENT_AI_PROVIDER || undefined,
    model: overrides.model || process.env.PRODUCT_CONTENT_AI_MODEL || undefined,
    maxTokens: overrides.maxTokens || process.env.PRODUCT_CONTENT_AI_MAX_TOKENS || undefined,
    temperature: overrides.temperature || process.env.PRODUCT_CONTENT_AI_TEMPERATURE || undefined
  })

  return {
    ...runtimeConfig,
    maxTokens: runtimeConfig.maxTokens || 2500,
    temperature: Number.isFinite(Number(runtimeConfig.temperature)) ? Number(runtimeConfig.temperature) : 0.5
  }
}

function buildUserPrompt({ action, target, product, language }) {
  return JSON.stringify({
    task: 'product_content_assistant',
    action,
    target,
    language: language || 'vi',
    outputSchema: {
      title: 'string',
      features: ['string'],
      description: '<p>HTML</p>',
      content: '<h2>HTML</h2>',
      deliveryInstructions: 'string',
      translations: {
        en: {
          title: 'string',
          features: ['string'],
          description: '<p>HTML</p>',
          content: '<h2>HTML</h2>',
          deliveryInstructions: 'string'
        }
      }
    },
    product
  })
}

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

async function generateProductContent({ action, target, product = {}, language = 'vi', provider, model, maxTokens, temperature }) {
  if (!isAllowedAction(action)) throw new Error(`Unsupported action: ${action}`)
  if (!isAllowedTarget(target)) throw new Error(`Unsupported target: ${target}`)

  const config = await resolveConfig({ provider, model, maxTokens, temperature })
  const client = getClient(config.provider)

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt({ action, target, product, language }) }
    ],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    response_format: { type: 'json_object' }
  })

  const content = response.choices?.[0]?.message?.content

  return {
    provider: config.provider,
    model: config.model,
    result: extractJson(content)
  }
}

module.exports = {
  ACTIONS,
  TARGETS,
  generateProductContent,
  isAllowedAction,
  isAllowedTarget
}











