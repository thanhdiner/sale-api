/**
 * Chat Service - DB logic for chat system
 */

const ChatMessage = require('../models/chatMessage.model')
const ChatConversation = require('../models/chatConversation.model')

function normalizeImageUrls(payload = {}) {
  const urls = []

  if (Array.isArray(payload.imageUrls)) {
    urls.push(...payload.imageUrls)
  }

  if (payload.imageUrl) {
    urls.unshift(payload.imageUrl)
  }

  return [...new Set(
    urls
      .filter(url => typeof url === 'string')
      .map(url => url.trim())
      .filter(Boolean)
  )]
}

function getConversationPreview(type, message, { isInternal = false } = {}) {
  if (isInternal) return '[Ghi chú nội bộ]'
  if (type === 'image') return '[Ảnh]'
  return message
}

// Conversation

/**
 * Lay hoac tao conversation theo sessionId
 * @returns {{ conversation, isNew: boolean }}
 */
async function getOrCreateConversation(sessionId, customer) {
  let conversation = await ChatConversation.findOne({ sessionId })
  const isNew = !conversation

  if (!conversation) {
    conversation = await ChatConversation.create({
      sessionId,
      status: 'unassigned',
      customer: {
        userId: customer.userId || null,
        name: customer.name || 'Khách ẩn danh',
        avatar: customer.avatar || null,
        currentPage: customer.currentPage || null
      }
    })
  }

  return { conversation, isNew }
}

/**
 * Cap nhat lastMessage sau khi customer gui
 */
async function updateConversationForCustomer(sessionId, message, senderName, senderAvatar, type = 'text') {
  await ChatConversation.updateOne(
    { sessionId },
    {
      $set: {
        lastMessage: getConversationPreview(type, message),
        lastMessageAt: new Date(),
        lastMessageSender: 'customer',
        'customer.name': senderName || 'Khách ẩn danh',
        'customer.avatar': senderAvatar || null
      },
      $inc: { unreadByAgent: 1, messageCount: 1 }
    }
  )
}

/**
 * Cap nhat lastMessage sau khi bot reply
 */
async function updateConversationForBot(sessionId, botText) {
  await ChatConversation.updateOne(
    { sessionId },
    {
      $set: {
        lastMessage: botText,
        lastMessageAt: new Date(),
        lastMessageSender: 'bot'
      },
      $inc: { 'botStats.messagesHandled': 1, messageCount: 1, unreadByCustomer: 1 }
    }
  )
}

/**
 * Cap nhat lastMessage sau khi agent reply
 */
async function updateConversationForAgent(sessionId, message, isInternal, hasFirstReply, type = 'text') {
  const updateFields = {
    lastMessage: getConversationPreview(type, message, { isInternal }),
    lastMessageAt: new Date(),
    lastMessageSender: 'agent'
  }

  if (!hasFirstReply && !isInternal) updateFields.firstReplyAt = new Date()

  await ChatConversation.updateOne(
    { sessionId },
    {
      $set: updateFields,
      $inc: { messageCount: 1, unreadByCustomer: isInternal ? 0 : 1 }
    }
  )
}

/**
 * Assign agent vao conversation
 */
async function assignAgent(sessionId, agent) {
  return ChatConversation.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        status: 'open',
        'assignedAgent.agentId': agent.agentId,
        'assignedAgent.agentName': agent.agentName,
        'assignedAgent.agentAvatar': agent.agentAvatar || null,
        'assignedAgent.assignedAt': new Date()
      }
    },
    { new: true }
  )
}

/**
 * Resolve conversation
 */
async function resolveConversation(sessionId) {
  return ChatConversation.findOneAndUpdate(
    { sessionId },
    { $set: { status: 'resolved', resolvedAt: new Date() } },
    { new: true }
  )
}

/**
 * Danh dau escalation
 */
async function markEscalation(sessionId, reason) {
  await ChatConversation.updateOne(
    { sessionId },
    {
      $set: {
        'botStats.escalated': true,
        'botStats.escalatedAt': new Date(),
        'botStats.escalationReason': reason
      }
    }
  )
}

/**
 * Chuyen lai sang bot
 */
async function switchToBot(sessionId) {
  await ChatConversation.updateOne(
    { sessionId },
    {
      $set: {
        'botStats.escalated': false,
        status: 'unassigned',
        assignedAgent: null
      }
    }
  )
}

/**
 * Lay conversation lean theo sessionId
 */
async function getConversation(sessionId) {
  return ChatConversation.findOne({ sessionId }).lean()
}

// Message

/**
 * Luu message tu customer
 */
async function saveCustomerMessage(conversationId, data) {
  const imageUrls = normalizeImageUrls(data)

  return ChatMessage.create({
    conversationId,
    sessionId: data.sessionId,
    sender: 'customer',
    senderId: data.senderId || null,
    senderName: data.senderName || 'Khách',
    senderAvatar: data.senderAvatar || null,
    type: data.type || 'text',
    message: data.message || '',
    imageUrl: imageUrls[0] || null,
    imageUrls,
    isRead: false
  })
}

/**
 * Luu message tu bot
 */
async function saveBotMessage(conversationId, sessionId, botReply) {
  return ChatMessage.create({
    conversationId,
    sessionId,
    sender: 'bot',
    type: 'text',
    senderName: 'SmartMall Bot',
    message: botReply.text,
    metadata: {
      suggestions: botReply.suggestions || [],
      provider: botReply.metadata?.provider,
      intent: botReply.metadata?.intent,
      responseTime: botReply.metadata?.responseTime,
      toolsUsed: botReply.metadata?.toolsUsed || []
    },
    isRead: false
  })
}

/**
 * Luu message tu agent
 */
async function saveAgentMessage(conversationId, data) {
  const imageUrls = normalizeImageUrls(data)

  return ChatMessage.create({
    conversationId,
    sessionId: data.sessionId,
    sender: 'agent',
    senderId: data.agentId || null,
    senderName: data.agentName || 'Support Agent',
    senderAvatar: data.agentAvatar || null,
    type: data.isInternal && (data.type || 'text') === 'text' ? 'note' : (data.type || 'text'),
    message: data.message || '',
    imageUrl: imageUrls[0] || null,
    imageUrls,
    isInternal: !!data.isInternal,
    isRead: true
  })
}

/**
 * Tao system message
 */
async function saveSystemMessage(conversationId, sessionId, text) {
  return ChatMessage.create({
    conversationId,
    sessionId,
    sender: 'system',
    type: 'system',
    senderName: 'System',
    message: text
  })
}

module.exports = {
  // Conversation
  getOrCreateConversation,
  updateConversationForCustomer,
  updateConversationForBot,
  updateConversationForAgent,
  assignAgent,
  resolveConversation,
  markEscalation,
  switchToBot,
  getConversation,
  // Message
  saveCustomerMessage,
  saveBotMessage,
  saveAgentMessage,
  saveSystemMessage
}
