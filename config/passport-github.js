const passport = require('passport')
const GitHubStrategy = require('passport-github2').Strategy
const User = require('../api/v1/models/user.model')

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const githubId = profile.id
        const email = profile.emails?.find(e => e.verified)?.value || `gh_${githubId}@github.com`
        const fullName = profile.displayName || profile.username
        const avatar = profile.photos?.[0]?.value

        let user = await User.findOne({ githubId })
        if (!user) {
          user = await User.create({
            githubId,
            username: `gh_${githubId}`,
            email,
            fullName,
            avatarUrl: avatar,
            passwordHash: '',
            status: 'active'
          })
        }

        done(null, user)
      } catch (err) {
        done(err)
      }
    }
  )
)
