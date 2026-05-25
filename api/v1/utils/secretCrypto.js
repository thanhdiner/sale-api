const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'

function getKey() {
  const secret = process.env.AI_PROVIDER_SECRET_KEY
  if (!secret) {
    throw new Error('Missing AI_PROVIDER_SECRET_KEY')
  }

  return crypto.createHash('sha256').update(secret).digest()
}

function encryptSecret(value = '') {
  const text = String(value || '').trim()
  if (!text) return null

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])

  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  }
}

function decryptSecret(payload = {}) {
  if (!payload?.iv || !payload?.authTag || !payload?.data) return ''

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

module.exports = {
  encryptSecret,
  decryptSecret
}
