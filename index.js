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

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
})

// Đăng ký io vào singleton (dùng được ở controllers)
initIO(io)

io.on('connection', socket => {
  logger.info(`[Socket] Client connected: ${socket.id}`)

  // Client tự join vào room theo role
  // Frontend emit: socket.emit('join', { role: 'admin' | 'user', userId })
  socket.on('join', ({ role, userId }) => {
    if (role === 'admin') {
      socket.join('admin')
      logger.info(`[Socket] Admin joined: ${socket.id}`)
    }
    if (userId) {
      socket.join(`user_${userId}`)
      logger.info(`[Socket] User ${userId} joined`)
    }
  })

  socket.on('disconnect', () => {
    logger.info(`[Socket] Client disconnected: ${socket.id}`)
  })
})

// ─── Routes ──────────────────────────────────────────────────────────────────
const routeApiV1Admin = require('./api/v1/routes/admin/index.route')
const routeApiV1 = require('./api/v1/routes/client/index.route')

routeApiV1Admin(app)
routeApiV1(app)

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(port, () => {
  logger.info(`🚀 Server started on PORT: ${port}`)
})
