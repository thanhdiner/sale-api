/**
 * Socket.IO connection handlers
 */

const logger = require('../../../config/logger')
const chatService = require('../services/chat.service')
const { ROOMS, EVENTS } = require('./constants')
const { validateString, validateSessionId, validateObjectId } = require('./validators')

const MAX_CHAT_IMAGES = 10

function parseImageUrls(data) {
  const rawUrls = []

  if (Array.isArray(data.imageUrls)) {
    rawUrls.push(...data.imageUrls)
  }

  if (typeof data.imageUrl === 'string' && data.imageUrl.trim()) {
    rawUrls.unshift(data.imageUrl)
  }

  const imageUrls = [...new Set(
    rawUrls
      .map((value, index) => validateString(value, `imageUrls[${index}]`, { maxLength: 1000 }))
      .filter(Boolean)
  )]

  if (imageUrls.length > MAX_CHAT_IMAGES) {
    throw new Error(`Tối đa ${MAX_CHAT_IMAGES} ảnh một lần gửi`)
  }

  return imageUrls
}

function parseChatPayload(data) {
  const imageUrls = parseImageUrls(data)
  const type = data.type === 'image' || imageUrls.length > 0 ? 'image' : 'text'
  const message =
    validateString(data.message, 'message', {
      required: type !== 'image',
      maxLength: 2000
    }) || ''

  if (type === 'image' && imageUrls.length === 0) {
    throw new Error('imageUrls là bắt buộc')
  }

  return {
    type,
    message,
    imageUrl: imageUrls[0] || null,
    imageUrls
  }
}

function buildBotInput({ type, message, imageUrls = [] }) {
  if (type === 'text') return message

  const trimmedMessage = typeof message === 'string' ? message.trim() : ''

  if (imageUrls.length > 0) {
    return {
      content: [
        {
          type: 'text',
          text: trimmedMessage || `Khách vừa gửi ${imageUrls.length} ảnh. Hãy xem trực tiếp nội dung các ảnh và hỗ trợ ngắn gọn bằng tiếng Việt.`
        },
        ...imageUrls.map(url => ({
          type: 'image_url',
          image_url: { url }
        }))
      ],
      promptText: trimmedMessage,
      memoryText: trimmedMessage
        ? `${trimmedMessage} [${imageUrls.length} ảnh đính kèm]`
        : `[${imageUrls.length} ảnh đính kèm]`
    }
  }

  return {
    promptText: trimmedMessage
      ? `Khách vừa gửi kèm ảnh và nhắn: "${trimmedMessage}". Lưu ý: bot hiện chưa thể xem trực tiếp nội dung pixel của ảnh. Hãy xác nhận đã nhận ảnh; nếu câu hỏi phụ thuộc vào việc nhìn ảnh thì nói rõ hạn chế này và mời khách mô tả chi tiết nội dung ảnh hoặc phần họ muốn kiểm tra.`
      : 'Khách vừa gửi kèm ảnh nhưng chưa nhắn thêm nội dung. Lưu ý: bot hiện chưa thể xem trực tiếp nội dung pixel của ảnh. Hãy xác nhận đã nhận ảnh và mời khách mô tả ảnh hoặc câu hỏi cần hỗ trợ.',
    memoryText: trimmedMessage || '[Ảnh đính kèm]'
  }
}

/**
 * Register all socket handlers for one connection
 * @param {import('socket.io').Server} io
 */
function registerHandlers(io) {
  io.on('connection', socket => {
    logger.info(`[Socket] Client connected: ${socket.id}`)

    // Role-based rooms
    socket.on(EVENTS.JOIN, ({ role, userId }) => {
      if (role === 'admin' || role === 'agent') {
        socket.join(ROOMS.AGENTS)
        logger.info(`[Socket] Agent/Admin joined: ${socket.id}`)
      }
      if (userId) {
        socket.join(ROOMS.user(userId))
      }
    })

    // Customer joins chat room
    socket.on(EVENTS.CHAT_JOIN, ({ sessionId }) => {
      try {
        const id = validateSessionId(sessionId)
        socket.join(ROOMS.chat(id))
      } catch (err) {
        logger.warn(`[Socket] chat:join invalid: ${err.message}`)
      }
    })

    // Customer sends message
    socket.on(EVENTS.CHAT_SEND, async data => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const { type, message, imageUrl, imageUrls } = parseChatPayload(data)
        const clientTempId = validateString(data.clientTempId, 'clientTempId', {
          required: false,
          maxLength: 120
        })
        const senderName = validateString(data.senderName, 'senderName', {
          required: false,
          maxLength: 100
        })
        const senderAvatar = validateString(data.senderAvatar, 'senderAvatar', {
          required: false,
          maxLength: 500
        })
        const senderId = validateObjectId(data.senderId, 'senderId')
        const currentPage = validateString(data.currentPage, 'currentPage', {
          required: false,
          maxLength: 500
        })

        const { conversation: conv, isNew } = await chatService.getOrCreateConversation(sessionId, {
          userId: senderId,
          name: senderName,
          avatar: senderAvatar,
          currentPage
        })

        const msg = await chatService.saveCustomerMessage(conv._id, {
          sessionId,
          type,
          message,
          imageUrl,
          imageUrls,
          senderId,
          senderName,
          senderAvatar
        })

        await chatService.updateConversationForCustomer(
          sessionId,
          message,
          senderName,
          senderAvatar,
          type
        )

        const payload = msg.toObject()
        if (clientTempId) payload.clientTempId = clientTempId
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, payload)

        if (isNew) {
          const updatedConv = await chatService.getConversation(sessionId)
          io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_NEW_CONVERSATION, updatedConv)
        } else {
          io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_NEW_MESSAGE, { ...payload, sessionId })
        }

        await handleBotReply(io, conv, sessionId, buildBotInput({ type, message, imageUrls }), {
          name: senderName,
          currentPage,
          userId: senderId,
          conversationId: conv._id?.toString()
        })
      } catch (err) {
        logger.error(`[Chat] send error: ${err.message}`)
      }
    })

    // Customer requests agent
    socket.on(EVENTS.CHAT_REQUEST_AGENT, async data => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const reason = validateString(data.reason, 'reason', { required: false, maxLength: 500 })

        const conv = await chatService.getConversation(sessionId)
        if (!conv) return

        const escalationReason = reason || 'Khách yêu cầu chuyển nhân viên'
        await chatService.markEscalation(sessionId, escalationReason)

        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          'Khách hàng yêu cầu nói chuyện với nhân viên hỗ trợ'
        )

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())

        const updatedConv = await chatService.getConversation(sessionId)
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
        io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_ESCALATION, {
          sessionId,
          reason: escalationReason,
          conversation: updatedConv
        })
        io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
      } catch (err) {
        logger.error(`[Chat] request_agent error: ${err.message}`)
      }
    })

    // Customer switches back to bot
    socket.on(EVENTS.CHAT_SWITCH_TO_BOT, async data => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const conv = await chatService.getConversation(sessionId)
        if (!conv) return

        await chatService.switchToBot(sessionId)

        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          'Trợ lý AI SmartMall Bot đã quay trở lại. Bạn cần tôi giúp gì?'
        )

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())

        const updatedConv = await chatService.getConversation(sessionId)
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
        io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
      } catch (err) {
        logger.error(`[Chat] switch_to_bot error: ${err.message}`)
      }
    })

    // Agent reply
    socket.on(EVENTS.CHAT_AGENT_REPLY, async data => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const { type, message, imageUrl, imageUrls } = parseChatPayload(data)
        const clientTempId = validateString(data.clientTempId, 'clientTempId', {
          required: false,
          maxLength: 120
        })
        const agentId = validateObjectId(data.agentId, 'agentId')
        const agentName = validateString(data.agentName, 'agentName', {
          required: false,
          maxLength: 100
        })
        const agentAvatar = validateString(data.agentAvatar, 'agentAvatar', {
          required: false,
          maxLength: 500
        })
        const isInternal = !!data.isInternal

        const conv = await chatService.getConversation(sessionId)
        if (!conv) return

        const msg = await chatService.saveAgentMessage(conv._id, {
          sessionId,
          type,
          message,
          imageUrl,
          imageUrls,
          agentId,
          agentName,
          agentAvatar,
          isInternal
        })

        await chatService.updateConversationForAgent(
          sessionId,
          message,
          isInternal,
          !!conv.firstReplyAt,
          type
        )

        const payload = msg.toObject()
        if (clientTempId) payload.clientTempId = clientTempId
        if (isInternal) {
          io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_MESSAGE, payload)
        } else {
          io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, payload)
          io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_MESSAGE, payload)
        }
      } catch (err) {
        logger.error(`[Chat] agent_reply error: ${err.message}`)
      }
    })

    // Agent assigns conversation
    socket.on(EVENTS.CHAT_ASSIGN, async data => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const agentId = validateObjectId(data.agentId, 'agentId')
        const agentName = validateString(data.agentName, 'agentName', {
          required: false,
          maxLength: 100
        })
        const agentAvatar = validateString(data.agentAvatar, 'agentAvatar', {
          required: false,
          maxLength: 500
        })

        const conv = await chatService.assignAgent(sessionId, {
          agentId,
          agentName,
          agentAvatar
        })
        if (!conv) return

        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          `${agentName || 'Agent'} đã tham gia cuộc trò chuyện`
        )

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, conv.toObject())
        io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, conv.toObject())
      } catch (err) {
        logger.error(`[Chat] assign error: ${err.message}`)
      }
    })

    // Agent resolves conversation
    socket.on(EVENTS.CHAT_RESOLVE, async data => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const agentName = validateString(data.agentName, 'agentName', {
          required: false,
          maxLength: 100
        })

        const conv = await chatService.resolveConversation(sessionId)
        if (!conv) return

        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          `${agentName || 'Agent'} đã đánh dấu cuộc trò chuyện là đã giải quyết`
        )

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_RESOLVED)
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, conv.toObject())
        io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, conv.toObject())
      } catch (err) {
        logger.error(`[Chat] resolve error: ${err.message}`)
      }
    })

    // Typing indicators
    socket.on(EVENTS.CHAT_TYPING, ({ sessionId, isTyping, role }) => {
      try {
        const id = validateSessionId(sessionId)
        if (role === 'agent') {
          socket.to(ROOMS.chat(id)).emit(EVENTS.CHAT_TYPING, { isTyping, role: 'agent' })
        } else {
          socket.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CUSTOMER_TYPING, { sessionId: id, isTyping })
        }
      } catch {
        // Ignore typing validation errors
      }
    })

    // Disconnect
    socket.on(EVENTS.DISCONNECT, () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}`)
    })
  })
}

async function handleBotReply(io, conv, sessionId, message, customer) {
  const hasAgent = conv.assignedAgent && conv.assignedAgent.agentId
  const isEscalated = conv.botStats?.escalated === true

  if (hasAgent || isEscalated) return

  try {
    const aiService = require('../services/ai/ai.service')
    const runtimeConfig = await aiService.getRuntimeConfig()
    if (!runtimeConfig.isEnabled) return

    io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_BOT_TYPING, { isTyping: true })

    const botReply = await aiService.processMessage(sessionId, message, customer, runtimeConfig)

    io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_BOT_TYPING, { isTyping: false })

    if (!botReply || !botReply.text) return

    const botMsg = await chatService.saveBotMessage(conv._id, sessionId, botReply)
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
    }
  } catch (botErr) {
    logger.error('[Chat] Bot processing error:', botErr.stack || botErr.message || botErr)
    io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_BOT_TYPING, { isTyping: false })
  }
}

module.exports = { registerHandlers }
