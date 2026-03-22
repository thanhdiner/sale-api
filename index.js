require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const database = require('./config/database')

const app = express()
const port = process.env.PORT

// ─── Security Headers ────────────────────────────────────────────────────────
// Helmet thêm các HTTP security headers quan trọng:
//   X-DNS-Prefetch-Control, X-Frame-Options (clickjacking), X-Content-Type-Options (MIME sniffing),
//   Strict-Transport-Security (HSTS), X-Download-Options, Referrer-Policy,
//   X-Permitted-Cross-Domain-Policies, X-XSS-Protection...
app.use(
  helmet({
    // Tắt CSP vì đây là REST API thuần (không render HTML)
    contentSecurityPolicy: false,
    // Tắt CORP để client không bị block khi load Cloudinary images/videos
    crossOriginResourcePolicy: false,
    // Tắt COEP vì không dùng SharedArrayBuffer
    crossOriginEmbedderPolicy: false,
    // Giữ nguyên tất cả các header khác
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,       // 1 năm
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  })
)

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'https://smartmall.site',
    credentials: true
  })
)

// ─── Body & Cookie Parsers ───────────────────────────────────────────────────
app.use(express.json())
app.use(cookieParser())

// ─── Database ────────────────────────────────────────────────────────────────
database.connect()

// ─── Routes ──────────────────────────────────────────────────────────────────
const routeApiV1Admin = require('./api/v1/routes/admin/index.route')
const routeApiV1 = require('./api/v1/routes/client/index.route')

routeApiV1Admin(app)
routeApiV1(app)

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`Start on PORT: ${port}`)
})
