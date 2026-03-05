const express = require('express')
const database = require('./config/database')
const app = express()
const cors = require('cors')

const cookieParser = require('cookie-parser')

app.use(express.json())
require('dotenv').config()
const port = process.env.PORT

database.connect()

app.use(cookieParser())

const routeApiV1 = require('./api/v1/routes/client/index.route')
const routeApiV1Admin = require('./api/v1/routes/admin/index.route')
// app.use(cors())
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'https://smartmall.site',
    credentials: true
  })
)

//# routes
routeApiV1Admin(app)
routeApiV1(app)

app.listen(port, () => {
  console.log(`Start on PORT: ${port}`)
})
