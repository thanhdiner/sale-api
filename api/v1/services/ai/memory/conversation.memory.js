/**
 * Conversation Memory — Quản lý context window cho AI chatbot
 * Dùng Redis cache để lưu conversation context (sliding window)
 */

const redis = require('../../../../../config/redis')
const logger = require('../../../../../config/logger')

const CONTEXT_PREFIX = 'chatbot:context:'
const CONTEXT_TTL = 30 * 60 // 30 phút
const MAX_MESSAGES = 20 // Sliding window

/**
 * Lấy conversation context từ Redis
 */
async function getContext(sessionId) {
  try {
    const client = redis.getClient()
    const data = await client.get(`${CONTEXT_PREFIX}${sessionId}`)
    return data ? JSON.parse(data) : []
  } catch (err) {
    logger.warn('[AI Memory] getContext error:', err.message)
    return []
  }
}

/**
 * Thêm message vào context (sliding window)
 */
async function addMessage(sessionId, role, content) {
  try {
    const client = redis.getClient()
    const key = `${CONTEXT_PREFIX}${sessionId}`

    let context = await getContext(sessionId)
    context.push({ role, content })

    // Sliding window — giữ max N messages gần nhất
    if (context.length > MAX_MESSAGES) {
      context = context.slice(-MAX_MESSAGES)
    }

    await client.set(key, JSON.stringify(context), 'EX', CONTEXT_TTL)
    return context
  } catch (err) {
    logger.warn('[AI Memory] addMessage error:', err.message)
    return []
  }
}

/**
 * Xoá context (khi conversation resolved hoặc reset)
 */
async function clearContext(sessionId) {
  try {
    const client = redis.getClient()
    await client.del(`${CONTEXT_PREFIX}${sessionId}`)
  } catch (err) {
    logger.warn('[AI Memory] clearContext error:', err.message)
  }
}

/**
 * Refresh TTL (khi có message mới)
 */
async function refreshTTL(sessionId) {
  try {
    const client = redis.getClient()
    await client.expire(`${CONTEXT_PREFIX}${sessionId}`, CONTEXT_TTL)
  } catch (err) {
    logger.warn('[AI Memory] refreshTTL error:', err.message)
  }
}

module.exports = {
  getContext,
  addMessage,
  clearContext,
  refreshTTL
}











