require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const { Server } = require('socket.io')
const swaggerUi = require('swagger-ui-express')

const database = require('./config/database')
const logger = require('./config/logger')
const redis = require('./config/redis')
const swaggerSpec = require('./config/swagger')

const morganMiddleware = require('./api/v1/middlewares/morgan.middleware')
const notFound = require('./api/v1/middlewares/notFound.middleware')
const errorHandler = require('./api/v1/middlewares/errorHandler.middleware')

const { initIO } = require('./api/v1/helpers/socket')
const { registerHandlers } = require('./api/v1/socket/handlers')

const adminRoutes = require('./api/v1/routes/admin/index.route')
const clientRoutes = require('./api/v1/routes/client/index.route')
const recalcRecommendScoreJob = require('./api/v1/jobs/recalcRecommendScore')
const releaseExpiredOrderReservationsJob = require('./api/v1/jobs/releaseExpiredOrderReservations')

const app = express()
const server = http.createServer(app)
const port = process.env.PORT
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

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

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
)

app.use(express.json())
app.use(cookieParser())
app.use(morganMiddleware)

database.connect()

process.on('unhandledRejection', reason => {
  logger.error('[Process] Unhandled Rejection:', reason?.message || String(reason))
})

redis
  .getClient()
  .connect()
  .catch(err => {
    logger.warn('[Redis] Không thể khởi tạo kết nối Redis:', err?.message || String(err))
  })

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
})

initIO(io)
registerHandlers(io)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

adminRoutes(app)
clientRoutes(app)

const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SmartMall API Documentation',
  customfavIcon: '/favicon.ico'
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions))
app.use('/docs', (req, res) => res.redirect('/api-docs'))

app.use(notFound)
app.use(errorHandler)

recalcRecommendScoreJob.start()
releaseExpiredOrderReservationsJob.start()

server.listen(port, () => {
  logger.info(`🚀 Server started on PORT: ${port}`)
})
