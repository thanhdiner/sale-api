/**
 * Chat Service - DB logic for chat system
 */

const chatMessageRepository = require('../repositories/chatMessage.repository')
const chatConversationRepository = require('../repositories/chatConversation.repository')
const adminAccountRepository = require('../repositories/adminAccount.repository')
const {
  getEnglishConversationPreview,
  getSystemMessageTranslations
} = require('../utils/chatLocalization')

const ALLOWED_MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

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

async function getAgentProfile(agent = {}) {
  let account = null

  if (agent.agentId && (!agent.agentName || !agent.agentAvatar)) {
    account = await adminAccountRepository.findById(agent.agentId, {
      select: 'fullName avatarUrl',
      lean: true
    })
  }

  return {
    agentId: agent.agentId || null,
    agentName: agent.agentName || account?.fullName || 'Agent',
    agentAvatar: agent.agentAvatar || account?.avatarUrl || null
  }
}

async function hydrateConversationAgent(conversation, { persist = false } = {}) {
  const agentId = conversation?.assignedAgent?.agentId
  if (!agentId || conversation.assignedAgent.agentAvatar) return conversation

  const agent = await getAgentProfile({
    agentId,
    agentName: conversation.assignedAgent.agentName,
    agentAvatar: conversation.assignedAgent.agentAvatar
  })

  const hydratedConversation = {
    ...conversation,
    assignedAgent: {
      ...conversation.assignedAgent,
      agentName: agent.agentName,
      agentAvatar: agent.agentAvatar
    }
  }

  if (persist && agent.agentAvatar) {
    await chatConversationRepository.updateOne(
      { sessionId: conversation.sessionId },
      {
        $set: {
          'assignedAgent.agentName': agent.agentName,
          'assignedAgent.agentAvatar': agent.agentAvatar
        }
      }
    )
  }

  return hydratedConversation
}

function getConversationPreview(type, message, { isInternal = false } = {}) {
  if (isInternal) return '[Ghi chú nội bộ]'
  if (type === 'image') return '[Ảnh]'
  return message
}

function getConversationPreviewTranslation(type, options = {}) {
  return getEnglishConversationPreview({ type, ...options }) || ''
}

function normalizeReactionActor({ reactorType, reactorId }) {
  return `${reactorType || ''}:${reactorId || ''}`
}

function toPlainMessage(message) {
  return typeof message?.toObject === 'function' ? message.toObject() : message
}

// Conversation

/**
 * Lay hoac tao conversation theo sessionId
 * @returns {{ conversation, isNew: boolean }}
 */
async function getOrCreateConversation(sessionId, customer) {
  let conversation = await chatConversationRepository.findOne({ sessionId })
  const isNew = !conversation

  if (!conversation) {
    conversation = await chatConversationRepository.create({
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
  await chatConversationRepository.updateOne(
    { sessionId },
    {
      $set: {
        lastMessage: getConversationPreview(type, message),
        lastMessageAt: new Date(),
        lastMessageSender: 'customer',
        lastMessageMetadata: null,
        'translations.en.lastMessage': getConversationPreviewTranslation(type),
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
  await chatConversationRepository.updateOne(
    { sessionId },
    {
      $set: {
        lastMessage: botText,
        lastMessageAt: new Date(),
        lastMessageSender: 'bot',
        lastMessageMetadata: null,
        'translations.en.lastMessage': ''
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
    lastMessageSender: 'agent',
    lastMessageMetadata: null,
    'translations.en.lastMessage': getConversationPreviewTranslation(type, { isInternal })
  }

  if (!hasFirstReply && !isInternal) updateFields.firstReplyAt = new Date()

  await chatConversationRepository.updateOne(
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
  const resolvedAgent = await getAgentProfile(agent)

  return chatConversationRepository.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        status: 'open',
        assignedAgent: {
          agentId: resolvedAgent.agentId,
          agentName: resolvedAgent.agentName,
          agentAvatar: resolvedAgent.agentAvatar,
          assignedAt: new Date()
        }
      }
    },
    { new: true }
  )
}

/**
 * Resolve conversation
 */
async function resolveConversation(sessionId) {
  return chatConversationRepository.findOneAndUpdate(
    { sessionId },
    { $set: { status: 'resolved', resolvedAt: new Date() } },
    { new: true }
  )
}

/**
 * Danh dau escalation
 */
async function markEscalation(sessionId, reason) {
  await chatConversationRepository.updateOne(
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
  await chatConversationRepository.updateOne(
    { sessionId },
    {
      $set: {
        'botStats.escalated': false,
        status: 'unassigned',
        assignedAgent: {
          agentId: null,
          agentName: null,
          agentAvatar: null,
          assignedAt: null
        }
      }
    }
  )
}

/**
 * Lay conversation lean theo sessionId
 */
async function getConversation(sessionId) {
  const conversation = await chatConversationRepository.findOne({ sessionId }, { lean: true })
  return hydrateConversationAgent(conversation, { persist: true })
}

// Message

/**
 * Luu message tu customer
 */
async function saveCustomerMessage(conversationId, data) {
  const imageUrls = normalizeImageUrls(data)

  return chatMessageRepository.create({
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
  return chatMessageRepository.create({
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
      escalationReason: botReply.metadata?.escalationReason,
      responseTime: botReply.metadata?.responseTime,
      toolsUsed: botReply.metadata?.toolsUsed || [],
      agentActivity: botReply.metadata?.agentActivity || []
    },
    isRead: false
  })
}

/**
 * Luu message tu agent
 */
async function saveAgentMessage(conversationId, data) {
  const imageUrls = normalizeImageUrls(data)
  const agent = await getAgentProfile({
    agentId: data.agentId,
    agentName: data.agentName,
    agentAvatar: data.agentAvatar
  })

  if (agent.agentId && agent.agentAvatar) {
    await chatConversationRepository.updateOne(
      {
        sessionId: data.sessionId,
        'assignedAgent.agentId': agent.agentId
      },
      {
        $set: {
          'assignedAgent.agentName': agent.agentName,
          'assignedAgent.agentAvatar': agent.agentAvatar
        }
      }
    )
  }

  return chatMessageRepository.create({
    conversationId,
    sessionId: data.sessionId,
    sender: 'agent',
    senderId: agent.agentId,
    senderName: agent.agentName,
    senderAvatar: agent.agentAvatar,
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
async function saveSystemMessage(conversationId, sessionId, text, metadata = null) {
  const translations = getSystemMessageTranslations(metadata)
  const message = await chatMessageRepository.create({
    conversationId,
    sessionId,
    sender: 'system',
    type: 'system',
    senderName: 'System',
    message: text,
    metadata,
    ...(translations ? { translations } : {})
  })

  await chatConversationRepository.updateOne(
    { sessionId },
    {
      $set: {
        lastMessage: text,
        lastMessageAt: new Date(),
        lastMessageSender: 'system',
        lastMessageMetadata: metadata || null,
        'translations.en.lastMessage': getConversationPreviewTranslation('system', { metadata })
      },
      $inc: { messageCount: 1 }
    }
  )

  return message
}

async function toggleMessageReaction(messageId, data = {}) {
  const emoji = data.emoji

  if (!ALLOWED_MESSAGE_REACTIONS.includes(emoji)) {
    return { statusCode: 400, body: { success: false, message: 'Reaction khong hop le' } }
  }

  const message = await chatMessageRepository.findById(messageId)

  if (!message || message.sessionId !== data.sessionId) {
    return { statusCode: 404, body: { success: false, message: 'Khong tim thay tin nhan' } }
  }

  if ((message.type === 'system' || message.sender === 'system') || (message.isInternal && data.reactorType !== 'agent')) {
    return { statusCode: 400, body: { success: false, message: 'Khong the react tin nhan nay' } }
  }

  const actorKey = normalizeReactionActor(data)
  const reactions = Array.isArray(message.reactions) ? [...message.reactions] : []
  const existingIndex = reactions.findIndex(reaction =>
    normalizeReactionActor(reaction) === actorKey
  )

  if (existingIndex !== -1 && reactions[existingIndex].emoji === emoji) {
    reactions.splice(existingIndex, 1)
  } else {
    const nextReaction = {
      emoji,
      reactorType: data.reactorType,
      reactorId: data.reactorId || null,
      reactorName: data.reactorName || '',
      createdAt: new Date()
    }

    if (existingIndex === -1) {
      reactions.push(nextReaction)
    } else {
      reactions[existingIndex] = nextReaction
    }
  }

  message.reactions = reactions
  await message.save()

  return { statusCode: 200, body: { success: true, data: toPlainMessage(message) } }
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
  saveSystemMessage,
  toggleMessageReaction
}
