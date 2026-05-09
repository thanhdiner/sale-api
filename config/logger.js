const { createLogger, format, transports } = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const path = require('path')

const LOG_DIR = path.join(__dirname, '..', 'logs')
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

// ─── Custom format ──────────────────────────────────────────────────────────
const customFormat = format.printf(({ timestamp, level, message, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message}${metaStr}`
})

// ─── Winston Logger ─────────────────────────────────────────────────────────
const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    customFormat
  ),
  transports: [
    // ─── Console ──────────────────────────────────────────────────────
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.errors({ stack: true }),
        format.printf(({ timestamp, level, message, stack, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
          return `${timestamp} ${level}: ${stack || message}${metaStr}`
        })
      )
    }),

    // ─── Combined log (tất cả levels) — rotate hàng ngày ─────────────
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',      // giữ log 14 ngày
      zippedArchive: true
    }),

    // ─── Error log riêng — rotate hàng ngày ──────────────────────────
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',      // error giữ 30 ngày
      zippedArchive: true
    })
  ],

  // Không crash app khi log lỗi
  exitOnError: false
})

// ─── Stream cho Morgan ──────────────────────────────────────────────────────
logger.stream = {
  write: (message) => {
    // Morgan tự thêm newline → trim bỏ
    logger.info(message.trim())
  }
}

module.exports = logger





