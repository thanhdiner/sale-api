const express = require('express')
const multer = require('multer')

const router = express.Router()
const {
  getHistory,
  getConversation,
  getConversations,
  uploadImage,
  assignConversation,
  resolveConversation,
  reopenConversation,
  markRead
} = require('../../controllers/client/chat.controller')
const { createRateLimiter } = require('../../middlewares/client/rateLimit.middleware')

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype?.startsWith('image/'))
})

router.get('/history/:sessionId', getHistory)
router.get('/conversation/:sessionId', getConversation)
router.get('/conversations', getConversations)
router.post(
  '/upload',
  createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: {
      success: false,
      message: 'Bạn tải ảnh quá nhiều. Vui lòng thử lại sau.'
    }
  }),
  fileUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  uploadImage
)
router.patch('/assign/:sessionId', assignConversation)
router.patch('/resolve/:sessionId', resolveConversation)
router.patch('/reopen/:sessionId', reopenConversation)
router.patch('/read/:sessionId', markRead)

module.exports = router
