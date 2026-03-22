const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/user.controller')
const passport = require('passport')
require('../../../../config/passport-google')
require('../../../../config/passport-facebook')
require('../../../../config/passport-github')

const authenticateToken = require('../../middlewares/client/authenticateToken.middleware')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

const validate = require('../../middlewares/validate.middleware')
const userSchemas = require('../../validations/user.validation')

router.get('/me', authenticateToken.authenticateToken, controller.getMe)
router.post('/login', validate(userSchemas.login), controller.login)
router.post('/register', validate(userSchemas.register), controller.register)
router.post('/logout', controller.logout)
router.post('/refresh-token', controller.refreshToken)
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  controller.googleLoginCallback
)
router.post('/oauth-code-login', validate(userSchemas.oauthCodeLogin), controller.oauthCodeLogin)
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }))
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  controller.facebookLoginCallback
)
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }))

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  controller.githubLoginCallback
)

router.post('/forgot-password', validate(userSchemas.forgotPassword), controller.forgotPassword)
router.post('/verify-reset-code', validate(userSchemas.verifyResetCode), controller.verifyResetCode)
router.post('/reset-password', validate(userSchemas.resetPassword), controller.resetPassword)
router.patch(
  '/update-profile',
  authenticateToken.authenticateToken,
  fileUpload.single('avatarUrl'),
  uploadCloud.deleteImage,
  uploadCloud.upload,
  validate(userSchemas.updateProfile),
  controller.updateProfile
)
router.post(
  '/request-email-update',
  authenticateToken.authenticateToken,
  validate(userSchemas.requestEmailUpdate),
  controller.requestEmailUpdate
)
router.post(
  '/confirm-email-update',
  authenticateToken.authenticateToken,
  validate(userSchemas.confirmEmailUpdate),
  controller.confirmEmailUpdate
)
router.patch(
  '/change-password',
  authenticateToken.authenticateToken,
  validate(userSchemas.changePassword),
  controller.changePassword
)

module.exports = router
