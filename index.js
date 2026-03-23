require('dotenv').config()

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const database = require('./config/database')
const logger = require('./config/logger')
const morganMiddleware = require('./api/v1/middlewares/morgan.middleware')
const notFound = require('./api/v1/middlewares/notFound.middleware')
const errorHandler = require('./api/v1/middlewares/errorHandler.middleware')
const { initIO } = require('./api/v1/helpers/socket')

const app = express()
const server = http.createServer(app)
const port = process.env.PORT

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  })
)

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
)

// ─── Body & Cookie Parsers ───────────────────────────────────────────────────
app.use(express.json())
app.use(cookieParser())

// ─── HTTP Request Logging (Morgan → Winston) ────────────────────────────────
app.use(morganMiddleware)

// ─── Database ────────────────────────────────────────────────────────────────
database.connect()

// ─── Redis ───────────────────────────────────────────────────────────────────
const redis = require('./config/redis')
redis.getClient().connect().catch(() => {}) // graceful — không crash nếu Redis offline

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
})

// Đăng ký io vào singleton (dùng được ở controllers)
initIO(io)

const ChatMessage = require('./api/v1/models/chatMessage.model')
const ChatConversation = require('./api/v1/models/chatConversation.model')

io.on('connection', socket => {
  logger.info(`[Socket] Client connected: ${socket.id}`)

  // ─── Role-based rooms ────────────────────────────────────────────────────────
  socket.on('join', ({ role, userId }) => {
    if (role === 'admin' || role === 'agent') {
      socket.join('agents')
      logger.info(`[Socket] Agent/Admin joined: ${socket.id}`)
    }
    if (userId) {
      socket.join(`user_${userId}`)
    }
  })

  // ─── Customer: join phòng chat của mình ─────────────────────────────────────
  socket.on('chat:join', ({ sessionId }) => {
    socket.join(`chat_${sessionId}`)
  })

  // ─── Customer: gửi tin nhắn ─────────────────────────────────────────────────
  socket.on('chat:send', async ({ sessionId, message, senderName, senderAvatar, senderId, currentPage }) => {
    try {
      // Lấy hoặc tạo conversation
      let conv = await ChatConversation.findOne({ sessionId })
      const isNew = !conv
      if (!conv) {
        conv = await ChatConversation.create({
          sessionId,
          status: 'unassigned',
          customer: {
            userId: senderId || null,
            name: senderName || 'Khách ẩn danh',
            avatar: senderAvatar || null,
            currentPage: currentPage || null
          }
        })
      }

      // Lưu tin nhắn
      const msg = await ChatMessage.create({
        conversationId: conv._id,
        sessionId,
        sender: 'customer',
        senderId: senderId || null,
        senderName: senderName || 'Khách',
        senderAvatar: senderAvatar || null,
        type: 'text',
        message: message.trim(),
        isRead: false
      })

      // Cập nhật conversation
      await ChatConversation.updateOne({ sessionId }, {
        $set: {
          lastMessage: message.trim(),
          lastMessageAt: new Date(),
          lastMessageSender: 'customer',
          'customer.name': senderName || 'Khách ẩn danh',
          'customer.avatar': senderAvatar || null
        },
        $inc: { unreadByAgent: 1, messageCount: 1 }
      })

      const payload = msg.toObject()
      // Gửi về customer trong session này
      io.to(`chat_${sessionId}`).emit('chat:message', payload)
      // Thông báo agents có tin nhắn mới (kể cả conversation mới)
      if (isNew) {
        const updatedConv = await ChatConversation.findById(conv._id).lean()
        io.to('agents').emit('chat:new_conversation', updatedConv)
      } else {
        io.to('agents').emit('chat:new_message', { ...payload, sessionId })
      }
    } catch (err) {
      logger.error('[Chat] send error:', err.message)
    }
  })

  // ─── Agent: reply ────────────────────────────────────────────────────────────
  socket.on('chat:agent_reply', async ({ sessionId, message, agentId, agentName, agentAvatar, isInternal }) => {
    try {
      const conv = await ChatConversation.findOne({ sessionId })
      if (!conv) return

      const msg = await ChatMessage.create({
        conversationId: conv._id,
        sessionId,
        sender: 'agent',
        senderId: agentId || null,
        senderName: agentName || 'Support Agent',
        senderAvatar: agentAvatar || null,
        type: isInternal ? 'note' : 'text',
        message: message.trim(),
        isInternal: !!isInternal,
        isRead: true
      })

      // Cập nhật firstReplyAt nếu chưa có
      const updateFields = {
        lastMessage: isInternal ? '[Ghi chú nội bộ]' : message.trim(),
        lastMessageAt: new Date(),
        lastMessageSender: 'agent'
      }
      if (!conv.firstReplyAt && !isInternal) updateFields.firstReplyAt = new Date()

      await ChatConversation.updateOne({ sessionId }, {
        $set: updateFields,
        $inc: { messageCount: 1, unreadByCustomer: isInternal ? 0 : 1 }
      })

      const payload = msg.toObject()
      // Internal notes: chỉ agents thấy
      if (isInternal) {
        io.to('agents').emit('chat:message', payload)
      } else {
        io.to(`chat_${sessionId}`).emit('chat:message', payload)
        io.to('agents').emit('chat:message', payload)
      }
    } catch (err) {
      logger.error('[Chat] agent_reply error:', err.message)
    }
  })

  // ─── Agent: assign conversation ──────────────────────────────────────────────
  socket.on('chat:assign', async ({ sessionId, agentId, agentName, agentAvatar }) => {
    try {
      const conv = await ChatConversation.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            status: 'open',
            'assignedAgent.agentId': agentId,
            'assignedAgent.agentName': agentName,
            'assignedAgent.agentAvatar': agentAvatar || null,
            'assignedAgent.assignedAt': new Date()
          }
        },
        { new: true }
      )
      if (!conv) return

      const sysMsg = await ChatMessage.create({
        conversationId: conv._id,
        sessionId,
        sender: 'system',
        type: 'system',
        senderName: 'System',
        message: `${agentName} đã tham gia cuộc trò chuyện`
      })

      io.to(`chat_${sessionId}`).emit('chat:message', sysMsg.toObject())
      io.to('agents').emit('chat:conversation_updated', conv.toObject())
    } catch (err) {
      logger.error('[Chat] assign error:', err.message)
    }
  })

  // ─── Agent: resolve conversation ─────────────────────────────────────────────
  socket.on('chat:resolve', async ({ sessionId, agentName }) => {
    try {
      const conv = await ChatConversation.findOneAndUpdate(
        { sessionId },
        { $set: { status: 'resolved', resolvedAt: new Date() } },
        { new: true }
      )
      if (!conv) return

      const sysMsg = await ChatMessage.create({
        conversationId: conv._id,
        sessionId,
        sender: 'system',
        type: 'system',
        senderName: 'System',
        message: `${agentName || 'Agent'} đã đánh dấu cuộc trò chuyện là đã giải quyết`
      })

      io.to(`chat_${sessionId}`).emit('chat:message', sysMsg.toObject())
      io.to(`chat_${sessionId}`).emit('chat:resolved')
      io.to('agents').emit('chat:conversation_updated', conv.toObject())
    } catch (err) {
      logger.error('[Chat] resolve error:', err.message)
    }
  })

  // ─── Typing indicators ───────────────────────────────────────────────────────
  socket.on('chat:typing', ({ sessionId, isTyping, role }) => {
    if (role === 'agent') {
      // Agent đang gõ → gửi về customer
      socket.to(`chat_${sessionId}`).emit('chat:typing', { isTyping, role: 'agent' })
    } else {
      // Customer đang gõ → gửi về agents
      socket.to('agents').emit('chat:customer_typing', { sessionId, isTyping })
    }
  })

  socket.on('disconnect', () => {
    logger.info(`[Socket] Client disconnected: ${socket.id}`)
  })
})

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }))

// ─── Routes ──────────────────────────────────────────────────────────────────

const routeApiV1Admin = require('./api/v1/routes/admin/index.route')
const routeApiV1 = require('./api/v1/routes/client/index.route')

routeApiV1Admin(app)
routeApiV1(app)

// ─── Swagger Documentation ───────────────────────────────────────────────────
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./config/swagger')

const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SmartMall API Documentation',
  customfavIcon: '/favicon.ico'
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions))
app.use('/docs', (req, res) => res.redirect('/api-docs'))

// ─── Global Error Handlers ───────────────────────────────────────────────────
// Order matters: notFound FIRST then errorHandler
app.use(notFound)
app.use(errorHandler)

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(port, () => {
  logger.info(`🚀 Server started on PORT: ${port}`)
})
