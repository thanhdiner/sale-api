/**
 * Knowledge Loader — Load và cache knowledge base từ markdown files
 */

const fs = require('fs')
const path = require('path')
const logger = require('../../../../config/logger')

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge')

// In-memory cache (load 1 lần khi server start)
let _cache = null

/**
 * Load tất cả knowledge files từ thư mục knowledge/
 * @returns {Object} { faq, policies, brandVoice, productGuide }
 */
function loadKnowledge() {
  if (_cache) return _cache

  try {
    const files = {
      faq: 'faq.md',
      policies: 'policies.md',
      brandVoice: 'brand-voice.md',
      productGuide: 'product-guide.md'
    }

    _cache = {}
    for (const [key, filename] of Object.entries(files)) {
      const filePath = path.join(KNOWLEDGE_DIR, filename)
      if (fs.existsSync(filePath)) {
        _cache[key] = fs.readFileSync(filePath, 'utf-8')
        logger.info(`[AI Knowledge] Loaded ${filename} (${_cache[key].length} chars)`)
      } else {
        _cache[key] = ''
        logger.warn(`[AI Knowledge] File not found: ${filename}`)
      }
    }

    return _cache
  } catch (err) {
    logger.error('[AI Knowledge] Load error:', err.message)
    return { faq: '', policies: '', brandVoice: '', productGuide: '' }
  }
}

/**
 * Force reload knowledge (khi admin cập nhật KB)
 */
function reloadKnowledge() {
  _cache = null
  return loadKnowledge()
}

/**
 * Lấy 1 knowledge section
 */
function getSection(section) {
  const kb = loadKnowledge()
  return kb[section] || ''
}

module.exports = {
  loadKnowledge,
  reloadKnowledge,
  getSection
}
