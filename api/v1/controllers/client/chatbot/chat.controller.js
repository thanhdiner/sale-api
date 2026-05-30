const logger = require('../../../../../config/logger')
const { getIO } = require('../../../helpers/socket')
const { ROOMS, EVENTS } = require('../../../socket/constants')
const chatService = require('../../../services/client/chatbot/chat.service')

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
    logger.error('Failed to emit chat conversation update:', error)
  }
}

function sendServiceResult(res, result) {
  if (typeof result?.statusCode === 'number') {
    return res.status(result.statusCode).json(result.body)
  }

  return res.json(result)
}


const getHistory = async (req, res, next) => {
  try {
    const result = await chatService.getHistory({
      sessionId: req.params.sessionId,
      showInternal: req.query.internal === 'true',
      requestQuery: req.query
    })
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

const getConversation = async (req, res, next) => {
  try {
    const result = await chatService.getConversation(req.params.sessionId)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

const getConversations = async (req, res, next) => {
  try {
    const result = await chatService.getConversations(req.query)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

const uploadImage = async (req, res, next) => {
  try {
    const result = await chatService.uploadImage(req.files)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

const assignConversation = async (req, res, next) => {
  try {
    const result = await chatService.assignConversation(req.params.sessionId, req.body)
    emitConversationUpdate(req.params.sessionId, result)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

const resolveConversation = async (req, res, next) => {
  try {
    const result = await chatService.resolveConversation(req.params.sessionId)
    emitConversationUpdate(req.params.sessionId, result, { emitResolved: true })
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

const reopenConversation = async (req, res, next) => {
  try {
    const result = await chatService.reopenConversation(req.params.sessionId)
    emitConversationUpdate(req.params.sessionId, result)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

const markRead = async (req, res, next) => {
  try {
    const result = await chatService.markRead(req.params.sessionId, req.body.reader)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
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










