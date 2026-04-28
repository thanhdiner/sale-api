const SYSTEM_MESSAGE_ENGLISH_TEMPLATES = {
  'system.agentJoined': values => `${values?.agentName || 'Agent'} joined the conversation`,
  'system.agentResolved': values => `${values?.agentName || 'Agent'} marked the conversation as resolved`,
  'system.botReturned': () => 'AI assistant SmartMall Bot is back. How can I help you?',
  'system.requestedHuman': () => 'The customer requested to talk to a support agent',
  'system.resolved': () => 'The conversation has been marked as resolved',
  'system.reopened': () => 'The conversation has been reopened'
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function getEnglishSystemMessage(metadata = {}) {
  const key = metadata?.i18nKey
  const template = key ? SYSTEM_MESSAGE_ENGLISH_TEMPLATES[key] : null

  if (typeof template !== 'function') {
    return ''
  }

  return template(metadata?.i18nValues || {})
}

function getSystemMessageTranslations(metadata = {}) {
  const message = getEnglishSystemMessage(metadata)

  return hasText(message)
    ? { en: { message } }
    : undefined
}

function getEnglishConversationPreview({ type, isInternal = false, metadata = null } = {}) {
  if (isInternal) return '[Internal note]'
  if (type === 'image') return '[Image]'
  if (type === 'system') return getEnglishSystemMessage(metadata)

  return ''
}

module.exports = {
  getEnglishConversationPreview,
  getEnglishSystemMessage,
  getSystemMessageTranslations
}
