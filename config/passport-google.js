const GoogleStrategy = require('passport-google-oauth20').Strategy
const { uploadImageFromUrl } = require('../api/v1/middlewares/upload/uploadCloud.middleware')
const User = require('../api/v1/models/access/user.model')
const passport = require('passport')

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (clientAccessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
        let user = await User.findOne({ email })
        if (!user) {
          let avatarUrl = ''
          if (profile.photos?.[0]?.value) {
            const result = await uploadImageFromUrl(profile.photos[0].value, profile.id)
            avatarUrl = result.secure_url
          }

          user = await User.create({
            username: profile.id,
            email: email,
            fullName: profile.displayName,
            avatarUrl,
            passwordHash: '',
            provider: 'google'
          })
        }
        done(null, user)
      } catch (err) {
        done(err)
      }
    }
  )
)





