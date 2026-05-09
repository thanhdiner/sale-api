/**
 * AI tool executor implementations for the policy domain.
 */

const {
  cleanString,
  DEFAULT_POLICY_SEARCH_LIMIT,
  excerptText,
  faqPageService,
  isPlainPolicyObject,
  logger,
  MAX_POLICY_SEARCH_LIMIT,
  normalizePolicyLanguage,
  normalizeSearchText,
  pickString,
  POLICY_SOURCE_META,
  POLICY_SOURCES,
  privacyPolicyPageService,
  returnPolicyPageService,
  termsContentService
} = require('./tool.helpers')

function normalizePolicyLimit(limit) {
  return Math.min(Math.max(Number(limit) || DEFAULT_POLICY_SEARCH_LIMIT, 1), MAX_POLICY_SEARCH_LIMIT)
}

function normalizePolicySourceName(source) {
  const normalized = normalizeSearchText(source)
  if (!normalized) return null

  if (['faq', 'faqs', 'hoi dap', 'cau hoi thuong gap'].includes(normalized)) return 'faq'
  if (['return', 'returns', 'refund', 'refunds', 'returnpolicy', 'doi tra', 'hoan tien', 'chinh sach doi tra'].includes(normalized)) return 'returnPolicy'
  if (['privacy', 'privacypolicy', 'bao mat', 'du lieu ca nhan', 'chinh sach bao mat'].includes(normalized)) return 'privacyPolicy'
  if (['terms', 'term', 'tos', 'termscontent', 'terms of service', 'dieu khoan', 'dieu khoan su dung'].includes(normalized)) return 'terms'

  return POLICY_SOURCES.includes(source) ? source : null
}

function normalizePolicySources(sources) {
  const rawSources = Array.isArray(sources)
    ? sources
    : (typeof sources === 'string' ? sources.split(',') : [])
  const normalizedSources = rawSources
    .map(source => normalizePolicySourceName(source))
    .filter(Boolean)

  return normalizedSources.length > 0
    ? [...new Set(normalizedSources)]
    : POLICY_SOURCES
}

function formatPolicyPath(path = []) {
  return path
    .filter(part => !/^\d+$/.test(String(part)))
    .map(part => String(part).replace(/([a-z])([A-Z])/g, '$1 $2'))
    .join(' > ')
}

function getPolicyTitle(node = {}, inheritedTitle = '', path = []) {
  return pickString(
    node.question,
    node.title,
    node.label,
    node.method,
    node.category,
    node.name,
    inheritedTitle,
    formatPolicyPath(path)
  )
}

function extractDirectPolicyText(node = {}) {
  const textParts = []

  Object.entries(node).forEach(([key, value]) => {
    if (['_id', '__v', 'id', 'key', 'url', 'callUrl', 'emailUrl', 'faqUrl'].includes(key)) return

    if (typeof value === 'string' && value.trim()) {
      textParts.push(value.trim())
      return
    }

    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      textParts.push(...value.map(item => item.trim()).filter(Boolean))
    }
  })

  return textParts
}

function collectPolicyEntries(node, {
  source,
  path = [],
  inheritedTitle = '',
  entries = []
} = {}) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      collectPolicyEntries(item, {
        source,
        path: [...path, index],
        inheritedTitle,
        entries
      })
    })
    return entries
  }

  if (isPlainPolicyObject(node)) {
    const title = getPolicyTitle(node, inheritedTitle, path)
    const directText = extractDirectPolicyText(node)

    if (directText.length > 0) {
      entries.push({
        source,
        sourceLabel: POLICY_SOURCE_META[source]?.label || source,
        title,
        path: formatPolicyPath(path),
        text: [...new Set(directText)].join(' '),
        url: POLICY_SOURCE_META[source]?.url || null
      })
    }

    Object.entries(node).forEach(([key, value]) => {
      if (typeof value === 'string') return
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) return

      collectPolicyEntries(value, {
        source,
        path: [...path, key],
        inheritedTitle: title,
        entries
      })
    })
  }

  return entries
}

function scorePolicyEntry(entry, query) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 1

  const haystack = normalizeSearchText(`${entry.sourceLabel} ${entry.title} ${entry.path} ${entry.text}`)
  const terms = normalizedQuery.split(/\s+/).filter(term => term.length > 1)
  let score = haystack.includes(normalizedQuery) ? 20 : 0

  terms.forEach(term => {
    if (haystack.includes(term)) score += 1
  })

  if (normalizeSearchText(entry.title).includes(normalizedQuery)) score += 8
  return score
}

function buildPolicyResult(entry, query = '') {
  return {
    source: entry.source,
    sourceLabel: entry.sourceLabel,
    title: entry.title,
    path: entry.path,
    excerpt: excerptText(entry.text, 280),
    url: entry.url,
    score: scorePolicyEntry(entry, query)
  }
}

async function getPolicySourceContent(source, language) {
  if (source === 'faq') {
    return (await faqPageService.getClientFaqPage(language))?.data || {}
  }

  if (source === 'returnPolicy') {
    return (await returnPolicyPageService.getClientReturnPolicyPage(language))?.data || {}
  }

  if (source === 'privacyPolicy') {
    return (await privacyPolicyPageService.getClientPrivacyPolicyPage(language))?.data || {}
  }

  if (source === 'terms') {
    return (await termsContentService.getTermsContent(language))?.data || {}
  }

  return {}
}

async function buildPolicyEntries({ sources = POLICY_SOURCES, language = 'vi' } = {}) {
  const entriesBySource = await Promise.all(
    sources.map(async source => {
      const content = await getPolicySourceContent(source, language)
      return collectPolicyEntries(content, { source })
    })
  )

  return entriesBySource.flat()
}

function filterPolicyEntries(entries = [], query = '', limit = DEFAULT_POLICY_SEARCH_LIMIT) {
  const normalizedLimit = normalizePolicyLimit(limit)
  const scoredEntries = entries
    .map(entry => ({ ...entry, score: scorePolicyEntry(entry, query) }))
    .filter(entry => !query || entry.score > 0)
    .sort((left, right) => right.score - left.score)

  return scoredEntries
    .slice(0, normalizedLimit)
    .map(entry => buildPolicyResult(entry, query))
}

async function searchPolicies({ query, sources, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const selectedSources = normalizePolicySources(sources)
    const entries = await buildPolicyEntries({
      sources: selectedSources,
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, query, limit)

    return JSON.stringify({
      found: results.length > 0,
      query: cleanString(query),
      language: normalizedLanguage,
      sources: selectedSources,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Khong tim thay noi dung chinh sach phu hop voi cau hoi nay.'
    })
  } catch (err) {
    logger.error('[AI Tool] searchPolicies error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi tim noi dung chinh sach.' })
  }
}

async function getReturnPolicy({ topic, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const entries = await buildPolicyEntries({
      sources: ['returnPolicy'],
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, topic, limit)

    return JSON.stringify({
      found: results.length > 0,
      topic: cleanString(topic),
      language: normalizedLanguage,
      source: 'returnPolicy',
      sourceLabel: POLICY_SOURCE_META.returnPolicy.label,
      url: POLICY_SOURCE_META.returnPolicy.url,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Chua co noi dung chinh sach doi tra phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] getReturnPolicy error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay chinh sach doi tra.' })
  }
}

async function getPrivacyPolicy({ topic, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const entries = await buildPolicyEntries({
      sources: ['privacyPolicy'],
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, topic, limit)

    return JSON.stringify({
      found: results.length > 0,
      topic: cleanString(topic),
      language: normalizedLanguage,
      source: 'privacyPolicy',
      sourceLabel: POLICY_SOURCE_META.privacyPolicy.label,
      url: POLICY_SOURCE_META.privacyPolicy.url,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Chua co noi dung chinh sach bao mat phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] getPrivacyPolicy error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay chinh sach bao mat.' })
  }
}

async function getTermsOfService({ topic, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const entries = await buildPolicyEntries({
      sources: ['terms'],
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, topic, limit)

    return JSON.stringify({
      found: results.length > 0,
      topic: cleanString(topic),
      language: normalizedLanguage,
      source: 'terms',
      sourceLabel: POLICY_SOURCE_META.terms.label,
      url: POLICY_SOURCE_META.terms.url,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Chua co noi dung dieu khoan su dung phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] getTermsOfService error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay dieu khoan su dung.' })
  }
}

async function getFAQ({ question, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const content = await getPolicySourceContent('faq', normalizedLanguage)
    const entries = collectPolicyEntries(content, { source: 'faq' })
    const results = filterPolicyEntries(entries, question, limit)

    return JSON.stringify({
      found: results.length > 0,
      question: cleanString(question),
      language: normalizedLanguage,
      source: 'faq',
      sourceLabel: POLICY_SOURCE_META.faq.label,
      url: POLICY_SOURCE_META.faq.url,
      count: results.length,
      faqs: results,
      message: results.length > 0
        ? null
        : 'Chua tim thay FAQ phu hop voi cau hoi nay.'
    })
  } catch (err) {
    logger.error('[AI Tool] getFAQ error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay FAQ.' })
  }
}

module.exports = {
  searchPolicies,
  getReturnPolicy,
  getPrivacyPolicy,
  getTermsOfService,
  getFAQ
}












