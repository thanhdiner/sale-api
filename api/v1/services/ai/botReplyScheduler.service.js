const logger = require('../../../../config/logger')
const chatService = require('../chat.service')
const { ROOMS, EVENTS } = require('../../socket/constants')

const DEFAULT_REPLY_DELAY_MS = 3000
const TYPING_HOLD_MS = 2500
const MIN_REPLY_DELAY_MS = 500
const MAX_REPLY_DELAY_MS = 10000

const pendingTimers = new Map()
const pendingMessages = new Map()
const pendingLastMessageAt = new Map()
const typingUntilBySessionId = new Map()
const runningConversations = new Set()
const dirtyConversations = new Set()

function getReplyDelayMs() {
  const parsed = Number.parseInt(process.env.CHAT_BOT_REPLY_DELAY_MS, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_REPLY_DELAY_MS
  return Math.min(Math.max(parsed, MIN_REPLY_DELAY_MS), MAX_REPLY_DELAY_MS)
}

function getConversationId(conversation) {
  return conversation?._id?.toString?.() || conversation?.id || null
}

function extractTextFromContent(content) {
  if (!Array.isArray(content)) return ''

  return content
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join('\n')
}

function extractImageUrlsFromContent(content) {
  if (!Array.isArray(content)) return []

  return content
    .filter(part => part?.type === 'image_url')
    .map(part => {
      if (typeof part.image_url === 'string') return part.image_url
      return part.image_url?.url
    })
    .filter(url => typeof url === 'string' && url.trim())
}

function normalizeBotInput(input) {
  if (typeof input === 'string') {
    return {
      promptText: input.trim(),
      memoryText: input.trim(),
      imageUrls: []
    }
  }

  if (!input || typeof input !== 'object') {
    return {
      promptText: '',
      memoryText: '',
      imageUrls: []
    }
  }

  const contentText = extractTextFromContent(input.content)
  const imageUrls = [
    ...(Array.isArray(input.imageUrls) ? input.imageUrls : []),
    ...(typeof input.imageUrl === 'string' ? [input.imageUrl] : []),
    ...extractImageUrlsFromContent(input.content)
  ].filter(url => typeof url === 'string' && url.trim())

  const promptText = typeof input.promptText === 'string'
    ? input.promptText.trim()
    : (typeof input.text === 'string' ? input.text.trim() : contentText)

  const memoryText = typeof input.memoryText === 'string'
    ? input.memoryText.trim()
    : promptText

  return {
    promptText,
    memoryText,
    imageUrls: [...new Set(imageUrls)]
  }
}

function combineBotInputs(messages = []) {
  const normalized = messages.map(item => normalizeBotInput(item.message))
  const promptLines = normalized
    .map(item => item.promptText)
    .filter(Boolean)
  const memoryLines = normalized
    .map(item => item.memoryText || item.promptText)
    .filter(Boolean)
  const imageUrls = [...new Set(normalized.flatMap(item => item.imageUrls))]

  if (imageUrls.length === 0) {
    return promptLines.join('\n')
  }

  const text = promptLines.length > 0
    ? `Nguoi dung vua gui lien tiep cac tin sau:\n${promptLines.join('\n')}`
    : `Nguoi dung vua gui ${imageUrls.length} anh lien tiep. Hay xem noi dung anh va ho tro ngan gon bang tieng Viet.`

  return {
    content: [
      { type: 'text', text },
      ...imageUrls.map(url => ({
        type: 'image_url',
        image_url: { url }
      }))
    ],
    promptText: promptLines.join('\n'),
    memoryText: memoryLines.length > 0
      ? memoryLines.join('\n')
      : `[${imageUrls.length} image attachment(s)]`,
    imageUrls
  }
}

function mergeCustomerInfo(messages = []) {
  const latest = messages[messages.length - 1]?.customer || {}
  const first = messages[0]?.customer || {}

  return {
    ...first,
    ...latest
  }
}

function shouldSkipBotReply(conversation) {
  if (!conversation) return true
  if (conversation.status === 'resolved') return true
  if (conversation.assignedAgent?.agentId) return true
  if (conversation.botStats?.escalated === true) return true
  return false
}

function emitBotTyping(io, sessionId, isTyping) {
  io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_BOT_TYPING, { isTyping })
}

function getPendingSessionId(conversationId) {
  const messages = pendingMessages.get(conversationId) || []
  return messages[messages.length - 1]?.sessionId || null
}

function scheduleFlush(io, conversationId, delayMs = getReplyDelayMs()) {
  const oldTimer = pendingTimers.get(conversationId)
  if (oldTimer) clearTimeout(oldTimer)

  const timer = setTimeout(() => {
    pendingTimers.delete(conversationId)

    const replyDelayMs = getReplyDelayMs()
    const lastMessageAt = pendingLastMessageAt.get(conversationId) || 0
    const quietForMs = Date.now() - lastMessageAt
    const remainingDelayMs = replyDelayMs - quietForMs

    if (remainingDelayMs > 50) {
      scheduleFlush(io, conversationId, remainingDelayMs)
      return
    }

    const sessionId = getPendingSessionId(conversationId)
    const typingUntil = sessionId ? typingUntilBySessionId.get(sessionId) || 0 : 0
    const typingDelayMs = typingUntil - Date.now()

    if (typingDelayMs > 50) {
      scheduleFlush(io, conversationId, typingDelayMs)
      return
    }

    flushBotReply(io, conversationId).catch(err => {
      logger.error('[Chat Bot] flush error:', err.stack || err.message || err)
    })
  }, delayMs)

  pendingTimers.set(conversationId, timer)
}

async function runBotReply(io, conversationId, messages) {
  const sessionId = messages[messages.length - 1]?.sessionId
  if (!sessionId) return

  const conversation = await chatService.getConversation(sessionId)
  if (shouldSkipBotReply(conversation)) return

  const aiService = require('./ai.service')
  const runtimeConfig = await aiService.getRuntimeConfig()
  if (!runtimeConfig.isEnabled) return

  const combinedMessage = combineBotInputs(messages)
  const customer = {
    ...mergeCustomerInfo(messages),
    conversationId
  }

  let typing = false

  try {
    emitBotTyping(io, sessionId, true)
    typing = true

    logger.info(`[Chat Bot] Processing ${messages.length} buffered message(s) for session ${sessionId}`)

    const botReply = await aiService.processMessage(sessionId, combinedMessage, customer, {
      ...runtimeConfig,
      onActivity: activity => {
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_BOT_ACTIVITY, {
          sessionId,
          ...activity
        })
      }
    })

    emitBotTyping(io, sessionId, false)
    typing = false

    if (!botReply || !botReply.text) return

    const latestConversation = await chatService.getConversation(sessionId)
    if (shouldSkipBotReply(latestConversation)) return

    const botMsg = await chatService.saveBotMessage(
      latestConversation?._id || conversationId,
      sessionId,
      botReply
    )
    await chatService.updateConversationForBot(sessionId, botReply.text)

    io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, botMsg.toObject())

    if (botReply.escalate) {
      await chatService.markEscalation(sessionId, botReply.escalateReason)
      const escalatedConv = await chatService.getConversation(sessionId)
      io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, escalatedConv)
      io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_ESCALATION, {
        sessionId,
        reason: botReply.escalateReason,
        conversation: escalatedConv
      })
      io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, escalatedConv)
    }
  } finally {
    if (typing) emitBotTyping(io, sessionId, false)
  }
}

async function flushBotReply(io, conversationId) {
  if (runningConversations.has(conversationId)) {
    dirtyConversations.add(conversationId)
    return
  }

  const messages = pendingMessages.get(conversationId) || []
  pendingMessages.delete(conversationId)
  pendingLastMessageAt.delete(conversationId)

  if (messages.length === 0) return

  dirtyConversations.delete(conversationId)
  runningConversations.add(conversationId)

  try {
    await runBotReply(io, conversationId, messages)
  } finally {
    runningConversations.delete(conversationId)

    if (
      pendingMessages.has(conversationId) &&
      (dirtyConversations.has(conversationId) || !pendingTimers.has(conversationId))
    ) {
      dirtyConversations.delete(conversationId)
      scheduleFlush(io, conversationId)
    }
  }
}

function scheduleBotReply({ io, conversation, sessionId, message, customer = {} }) {
  const conversationId = getConversationId(conversation)
  if (!io || !conversationId || !sessionId || !message) return
  if (shouldSkipBotReply(conversation)) return

  const messages = pendingMessages.get(conversationId) || []
  messages.push({
    sessionId,
    message,
    customer,
    receivedAt: new Date()
  })
  pendingMessages.set(conversationId, messages)
  pendingLastMessageAt.set(conversationId, Date.now())

  if (runningConversations.has(conversationId)) {
    dirtyConversations.add(conversationId)
  }

  scheduleFlush(io, conversationId)
}

function markCustomerTyping({ sessionId, isTyping }) {
  if (!sessionId) return

  if (isTyping) {
    typingUntilBySessionId.set(sessionId, Date.now() + TYPING_HOLD_MS)
    return
  }

  typingUntilBySessionId.delete(sessionId)
}

module.exports = {
  scheduleBotReply,
  flushBotReply,
  markCustomerTyping
}
