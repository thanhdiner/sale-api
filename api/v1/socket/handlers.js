/**
 * Socket.IO connection handlers
 */

const logger = require('../../../config/logger')
const chatService = require('../services/chat.service')
const {
  markCustomerTyping,
  scheduleBotReply
} = require('../services/ai/botReplyScheduler.service')
const { ROOMS, EVENTS } = require('./constants')
const { validateString, validateSessionId, validateObjectId, validateReactionEmoji } = require('./validators')

const MAX_CHAT_IMAGES = 10

function getSocketClientIp(socket) {
  const forwardedFor = socket.handshake?.headers?.['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return socket.handshake?.address || socket.conn?.remoteAddress || ''
}

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

function toPlainConversation(conversation) {
  return typeof conversation?.toObject === 'function' ? conversation.toObject() : conversation
}

function notifyResolvedConversation(io, socket, sessionId, conversation, callback) {
  const payload = toPlainConversation(conversation)

  socket.join(ROOMS.chat(sessionId))
  io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_RESOLVED)
  io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, payload)

  if (typeof callback === 'function') {
    callback({
      success: false,
      code: 'CHAT_RESOLVED',
      message: 'Conversation is resolved. Start a new conversation.',
      conversation: payload
    })
  }
}

function validateReactionRole(value) {
  const role = validateString(value, 'reactorType', { maxLength: 20 })
  if (!['customer', 'agent'].includes(role)) {
    throw new Error('reactorType khong hop le')
  }
  return role
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
    socket.on(EVENTS.CHAT_SEND, async (data, callback) => {
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

        if (!isNew && conv.status === 'resolved') {
          notifyResolvedConversation(io, socket, sessionId, conv, callback)
          return
        }

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

        if (typeof callback === 'function') {
          callback({ success: true, sessionId, messageId: msg._id?.toString() })
        }

        scheduleBotReply({
          io,
          conversation: conv,
          sessionId,
          message: buildBotInput({ type, message, imageUrls }),
          customer: {
            name: senderName,
            currentPage,
            ip: getSocketClientIp(socket),
            userId: senderId
          }
        })
      } catch (err) {
        logger.error(`[Chat] send error: ${err.message}`)
        if (typeof callback === 'function') {
          callback({ success: false, message: err.message || 'Send failed' })
        }
      }
    })

    // Customer/agent reacts to a message
    socket.on(EVENTS.CHAT_REACTION, async (data, callback) => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const messageId = validateObjectId(data.messageId, 'messageId', { required: true })
        const emoji = validateReactionEmoji(data.emoji)
        const reactorType = validateReactionRole(data.reactorType)
        const reactorId = validateString(data.reactorId, 'reactorId', {
          required: false,
          maxLength: 200
        }) || (reactorType === 'customer' ? sessionId : socket.id)
        const reactorName = validateString(data.reactorName, 'reactorName', {
          required: false,
          maxLength: 100
        })

        const result = await chatService.toggleMessageReaction(messageId, {
          sessionId,
          emoji,
          reactorType,
          reactorId,
          reactorName
        })

        if (!result?.body?.success) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              message: result?.body?.message || 'Reaction failed'
            })
          }
          return
        }

        const payload = result.body.data
        const target = payload.isInternal
          ? io.to(ROOMS.AGENTS)
          : io.to(ROOMS.chat(sessionId)).to(ROOMS.AGENTS)

        target.emit(EVENTS.CHAT_REACTION_UPDATED, payload)

        if (typeof callback === 'function') {
          callback({ success: true, message: payload })
        }
      } catch (err) {
        logger.error(`[Chat] reaction error: ${err.message}`)
        if (typeof callback === 'function') {
          callback({ success: false, message: err.message || 'Reaction failed' })
        }
      }
    })

    // Customer requests agent
    socket.on(EVENTS.CHAT_REQUEST_AGENT, async data => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const reason = validateString(data.reason, 'reason', { required: false, maxLength: 500 })

        const conv = await chatService.getConversation(sessionId)
        if (!conv) return
        if (conv.status === 'resolved') {
          notifyResolvedConversation(io, socket, sessionId, conv)
          return
        }

        const escalationReason = reason || 'Khách yêu cầu chuyển nhân viên'
        await chatService.markEscalation(sessionId, escalationReason)

        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          'Khách hàng yêu cầu nói chuyện với nhân viên hỗ trợ',
          { i18nKey: 'system.requestedHuman' }
        )

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())

        const updatedConv = await chatService.getConversation(sessionId) || conv.toObject()
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
        if (conv.status === 'resolved') {
          notifyResolvedConversation(io, socket, sessionId, conv)
          return
        }

        await chatService.switchToBot(sessionId)

        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          'Trợ lý AI SmartMall Bot đã quay trở lại. Bạn cần tôi giúp gì?',
          { i18nKey: 'system.botReturned' }
        )

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())

        const updatedConv = await chatService.getConversation(sessionId) || conv.toObject()
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
    socket.on(EVENTS.CHAT_ASSIGN, async (data, callback) => {
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

        const displayAgentName = agentName || 'Agent'
        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          `${displayAgentName} đã tham gia cuộc trò chuyện`,
          {
            i18nKey: 'system.agentJoined',
            i18nValues: { agentName: displayAgentName }
          }
        )
        const updatedConv = await chatService.getConversation(sessionId) || conv.toObject()

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
        io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
        if (typeof callback === 'function') {
          callback({ success: true, conversation: updatedConv })
        }
      } catch (err) {
        logger.error(`[Chat] assign error: ${err.message}`)
        if (typeof callback === 'function') {
          callback({ success: false, message: err.message || 'Assign failed' })
        }
      }
    })

    // Agent resolves conversation
    socket.on(EVENTS.CHAT_RESOLVE, async (data, callback) => {
      try {
        const sessionId = validateSessionId(data.sessionId)
        const agentName = validateString(data.agentName, 'agentName', {
          required: false,
          maxLength: 100
        })

        const conv = await chatService.resolveConversation(sessionId)
        if (!conv) return

        const displayAgentName = agentName || 'Agent'
        const sysMsg = await chatService.saveSystemMessage(
          conv._id,
          sessionId,
          `${displayAgentName} đã đánh dấu cuộc trò chuyện là đã giải quyết`,
          {
            i18nKey: 'system.agentResolved',
            i18nValues: { agentName: displayAgentName }
          }
        )
        const updatedConv = await chatService.getConversation(sessionId) || conv.toObject()

        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, sysMsg.toObject())
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_RESOLVED)
        io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
        io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, updatedConv)
        if (typeof callback === 'function') {
          callback({ success: true, conversation: updatedConv })
        }
      } catch (err) {
        logger.error(`[Chat] resolve error: ${err.message}`)
        if (typeof callback === 'function') {
          callback({ success: false, message: err.message || 'Resolve failed' })
        }
      }
    })

    // Typing indicators
    socket.on(EVENTS.CHAT_TYPING, ({ sessionId, isTyping, role }) => {
      try {
        const id = validateSessionId(sessionId)
        if (role === 'agent') {
          socket.to(ROOMS.chat(id)).emit(EVENTS.CHAT_TYPING, { isTyping, role: 'agent' })
        } else {
          markCustomerTyping({ sessionId: id, isTyping: !!isTyping })
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

module.exports = { registerHandlers }
