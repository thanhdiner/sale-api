require('dotenv').config()

// Core modules
const http = require('http')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const { Server } = require('socket.io')

// Config
const database = require('./config/database')
const logger = require('./config/logger')
const redis = require('./config/redis')

// Core middlewares
const morganMiddleware = require('./api/v1/middlewares/core/morgan.middleware')
const notFound = require('./api/v1/middlewares/core/notFound.middleware')
const errorHandler = require('./api/v1/middlewares/core/errorHandler.middleware')
const wrapAsyncRoutes = require('./api/v1/utils/wrapAsyncRoutes')

// Socket
const { initIO } = require('./api/v1/helpers/socket')
const { registerHandlers } = require('./api/v1/socket/handlers')

// Routes
const adminRoutes = require('./api/v1/routes/admin/index.route')
const clientRoutes = require('./api/v1/routes/client/index.route')

// App setup
const app = express()
const server = http.createServer(app)
const port = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === 'production'

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

// Security
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  })
)

// CORS
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
)

// Global middlewares
app.use(express.json())
app.use(cookieParser())
app.use(morganMiddleware)

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
})

initIO(io)
registerHandlers(io)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// API routes
adminRoutes(app)
clientRoutes(app)

// Swagger docs
function setupSwaggerDocs() {
  if (process.env.ENABLE_SWAGGER === 'false') {
    logger.info('[Swagger] Disabled by ENABLE_SWAGGER=false')
    return
  }

  const swaggerUi = require('swagger-ui-express')
  const swaggerSpec = require('./config/swagger')

  const swaggerOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SmartMall API Documentation',
    customfavIcon: '/favicon.ico'
  }

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions))
  app.use('/docs', (req, res) => res.redirect('/api-docs'))
}

setupSwaggerDocs()

// Error handlers
wrapAsyncRoutes(app)
app.use(notFound)
app.use(errorHandler)

// Process handlers
process.on('unhandledRejection', reason => {
  logger.error('[Process] Unhandled Rejection:', reason?.message || String(reason))
})

process.on('uncaughtException', err => {
  logger.error('[Process] Uncaught Exception:', err?.message || String(err))
  process.exit(1)
})

// Background jobs
function startJobs() {
  if (process.env.ENABLE_JOBS === 'false') {
    logger.info('[Jobs] Disabled by ENABLE_JOBS=false')
    return
  }

  const recalcRecommendScoreJob = require('./api/v1/jobs/recalcRecommendScore')
  const releaseExpiredOrderReservationsJob = require('./api/v1/jobs/releaseExpiredOrderReservations')
  const blogJobs = require('./api/v1/jobs/blogJobs')
  const dashboardSummaryJob = require('./api/v1/jobs/dashboardSummary.job')

  recalcRecommendScoreJob.start()
  releaseExpiredOrderReservationsJob.start()
  blogJobs.start()
  dashboardSummaryJob.start()
}

// Redis
async function connectRedis() {
  try {
    await redis.getClient().connect()
  } catch (err) {
    logger.warn('[Redis] Không thể khởi tạo kết nối Redis:', err?.message || String(err))
  }
}

// Bootstrap
async function bootstrap() {
  try {
    await database.connect()

    connectRedis()
    startJobs()

    server.listen(port, () => {
      logger.info(`Server started on PORT: ${port}`)
    })
} catch (err) {
    logger.error('[Bootstrap] Không thể khởi động server:', err?.message || String(err))
    process.exit(1)
  }
}

bootstrap()
