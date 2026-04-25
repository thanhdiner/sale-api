const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')
const { ROOMS, EVENTS } = require('../../socket/constants')
const chatService = require('../../services/client/chat.service')

function emitConversationUpdate(sessionId, result, { emitResolved = false } = {}) {
  if (!result?.body?.success || !result.body.data) return

  try {
    const io = getIO()
    const conversation = typeof result.body.data.toObject === 'function'
      ? result.body.data.toObject()
      : result.body.data
    const systemMessage = result.body.systemMessage
      ? (typeof result.body.systemMessage.toObject === 'function'
          ? result.body.systemMessage.toObject()
          : result.body.systemMessage)
      : null

    if (systemMessage) {
      io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_MESSAGE, systemMessage)
      io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_MESSAGE, systemMessage)
    }

    if (emitResolved) {
      io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_RESOLVED)
    }

    io.to(ROOMS.chat(sessionId)).emit(EVENTS.CHAT_CONVERSATION_UPDATED, conversation)
    io.to(ROOMS.AGENTS).emit(EVENTS.CHAT_CONVERSATION_UPDATED, conversation)
  } catch (error) {
    logger.error('[Client][Chat] emitConversationUpdate error:', error)
  }
}

function sendServiceResult(res, result) {
  if (typeof result?.statusCode === 'number') {
    return res.status(result.statusCode).json(result.body)
  }

  return res.json(result)
}

function handleUnexpectedError(res, message, err, fallbackMessage = 'Lỗi server') {
  logger.error(message, err)
  return res.status(500).json({ success: false, message: fallbackMessage })
}

const getHistory = async (req, res) => {
  try {
    const result = await chatService.getHistory({
      sessionId: req.params.sessionId,
      showInternal: req.query.internal === 'true'
    })
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] getHistory error:', err)
  }
}

const getConversation = async (req, res) => {
  try {
    const result = await chatService.getConversation(req.params.sessionId)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] getConversation error:', err)
  }
}

const getConversations = async (req, res) => {
  try {
    const result = await chatService.getConversations(req.query)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] getConversations error:', err)
  }
}

const uploadImage = async (req, res) => {
  try {
    const result = await chatService.uploadImage(req.files)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] uploadImage error:', err, 'Không thể upload ảnh chat')
  }
}

const assignConversation = async (req, res) => {
  try {
    const result = await chatService.assignConversation(req.params.sessionId, req.body)
    emitConversationUpdate(req.params.sessionId, result)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] assignConversation error:', err)
  }
}

const resolveConversation = async (req, res) => {
  try {
    const result = await chatService.resolveConversation(req.params.sessionId)
    emitConversationUpdate(req.params.sessionId, result, { emitResolved: true })
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] resolveConversation error:', err)
  }
}

const reopenConversation = async (req, res) => {
  try {
    const result = await chatService.reopenConversation(req.params.sessionId)
    emitConversationUpdate(req.params.sessionId, result)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] reopenConversation error:', err)
  }
}

const markRead = async (req, res) => {
  try {
    const result = await chatService.markRead(req.params.sessionId, req.body.reader)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][Chat] markRead error:', err)
  }
}

module.exports = {
  getHistory,
  getConversation,
  getConversations,
  uploadImage,
  assignConversation,
  resolveConversation,
  reopenConversation,
  markRead
}
