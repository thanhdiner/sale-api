const Redis = require('ioredis')
const logger = require('./logger')

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let client = null

function getClient() {
  if (client) return client

  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    // TLS bắt buộc khi dùng rediss:// (Upstash, Redis Cloud...)
    tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
    retryStrategy: times => {
      if (times > 3) {
        logger.warn('[Redis] Không thể kết nối Redis, sẽ chạy không có cache.')
        return null
      }
      return Math.min(times * 200, 2000)
    }
  })

  client.on('connect', () => logger.info('[Redis] Đã kết nối Redis'))
  client.on('error', err => logger.warn('[Redis] Lỗi:', err?.message || String(err)))
  client.on('end', () => logger.warn('[Redis] Kết nối Redis đã đóng'))

  // Prevent ioredis internal promise rejections from crashing the process
  client.on('close', () => {})
  client.on('reconnecting', () => {})

  return client
}

/**
 * Lấy data từ cache, nếu không có thì gọi fn() và lưu vào cache
 * @param {string} key - Cache key
 * @param {Function} fn - Hàm async trả về data cần cache
 * @param {number} ttlSecs - Thời gian sống (giây)
 */
async function getOrSet(key, fn, ttlSecs = 60) {
  const redis = getClient()

  try {
    const cached = await redis.get(key)
    if (cached !== null) {
      return JSON.parse(cached)
    }
  } catch {
    // Redis lỗi → bỏ qua, tiếp tục query DB
  }

  const data = await fn()

  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttlSecs)
  } catch {
    // Không lưu được cache → bỏ qua
  }

  return data
}

/**
 * Xóa một hoặc nhiều key cache (hỗ trợ pattern dùng scan)
 * @param {...string} keys - Danh sách key hoặc pattern (kết thúc bằng *)
 */
async function del(...keys) {
  const redis = getClient()
  try {
    for (const key of keys) {
      if (key.endsWith('*')) {
        // Scan và xóa theo pattern
        let cursor = '0'
        do {
          const [newCursor, found] = await redis.scan(cursor, 'MATCH', key, 'COUNT', 100)
          cursor = newCursor
          if (found.length > 0) await redis.del(...found)
        } while (cursor !== '0')
      } else {
        await redis.del(key)
      }
    }
  } catch (err) {
    logger.warn('[Redis] Lỗi khi xóa cache:', err.message)
  }
}

module.exports = { getClient, getOrSet, del }
