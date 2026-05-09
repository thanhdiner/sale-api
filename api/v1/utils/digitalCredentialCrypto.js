const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'

function getKey() {
  const secret = process.env.DIGITAL_CREDENTIAL_SECRET || process.env.JWT_SECRET || 'smartmall-development-digital-credential-secret'
  return crypto.createHash('sha256').update(secret).digest()
}

function encryptCredential(payload = {}) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted.toString('base64')
  }
}

function decryptCredential(encryptedPayload = {}) {
  if (!encryptedPayload.iv || !encryptedPayload.authTag || !encryptedPayload.data) {
    return {}
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(encryptedPayload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(encryptedPayload.authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPayload.data, 'base64')),
    decipher.final()
  ])

  return JSON.parse(decrypted.toString('utf8'))
}

function maskValue(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= 4) return '••••'
  return `${text.slice(0, 2)}••••${text.slice(-2)}`
}

function summarizeCredential(payload = {}) {
  return {
    username: maskValue(payload.username || payload.userName || payload.login),
    email: maskValue(payload.email || payload.loginEmail),
    licenseKey: maskValue(payload.licenseKey || payload.key || payload.activationKey),
    loginUrl: payload.loginUrl || payload.url || '',
    hasPassword: !!(payload.password || payload.pass),
    hasNotes: !!(payload.notes || payload.instructions)
  }
}

module.exports = {
  encryptCredential,
  decryptCredential,
  summarizeCredential
}









