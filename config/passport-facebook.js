const FacebookStrategy = require('passport-facebook').Strategy
const User = require('../api/v1/models/user.model')
const passport = require('passport')

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'emails', 'name', 'displayName', 'picture.type(large)']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ facebookId: profile.id })
        if (!user) {
          const fullName = profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim()
          user = await User.create({
            username: 'fb_' + profile.id,
            email: profile.emails?.[0]?.value || `fb${profile.id}@facebook.com`,
            facebookId: profile.id,
            fullName,
            avatarUrl: profile.photos?.[0]?.value,
            status: 'active'
          })
        }
        return done(null, user)
      } catch (err) {
        return done(err)
      }
    }
  )
)
