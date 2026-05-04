const MAX_CONTEXT_AGE_MS = 1000 * 60 * 60 * 6

const pageContexts = new Map()

function sanitizeString(value, maxLength) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function sanitizeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function sanitizeEntity(entity) {
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) return null

  const sanitized = {
    type: sanitizeString(entity.type, 80),
    id: sanitizeString(entity.id, 120),
    slug: sanitizeString(entity.slug, 200),
    title: sanitizeString(entity.title, 300),
    price: sanitizeNumber(entity.price),
    stock: sanitizeNumber(entity.stock),
    category: sanitizeString(entity.category, 160)
  }

  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== null && value !== undefined)
  )
}

function sanitizePageContext(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null

  const entity = sanitizeEntity(context.entity)
  const sanitized = {
    route: sanitizeString(context.route, 500),
    pageType: sanitizeString(context.pageType, 80),
    currentSection: sanitizeString(context.currentSection, 80),
    entity: entity && Object.keys(entity).length > 0 ? entity : null
  }

  const compact = Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== null && value !== undefined)
  )

  return Object.keys(compact).length > 0 ? compact : null
}

function pruneExpiredContexts(now = Date.now()) {
  for (const [sessionId, context] of pageContexts.entries()) {
    if (!context?.updatedAtMs || now - context.updatedAtMs > MAX_CONTEXT_AGE_MS) {
      pageContexts.delete(sessionId)
    }
  }
}

function updatePageContext(sessionId, context) {
  const sanitized = sanitizePageContext(context)
  if (!sessionId || !sanitized) return null

  const now = Date.now()
  pruneExpiredContexts(now)

  const previous = pageContexts.get(sessionId) || {}
  const next = {
    ...previous,
    ...sanitized,
    entity: sanitized.entity || previous.entity,
    updatedAt: new Date(now).toISOString(),
    updatedAtMs: now
  }

  pageContexts.set(sessionId, next)
  return getPageContext(sessionId)
}

function getPageContext(sessionId) {
  const context = pageContexts.get(sessionId)
  if (!context) return null

  const { updatedAtMs, ...publicContext } = context
  return publicContext
}

function clearPageContext(sessionId) {
  if (sessionId) pageContexts.delete(sessionId)
}

module.exports = {
  updatePageContext,
  getPageContext,
  clearPageContext,
  sanitizePageContext
}
