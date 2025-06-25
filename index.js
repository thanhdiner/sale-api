const express = require('express')
const database = require('./config/database')
const app = express()
const cors = require('cors')

require('dotenv').config()
const port = process.env.PORT

database.connect()

const routeApiV1 = require('./api/v1/routes/client/index.route')
const routeApiV1Admin = require('./api/v1/routes/admin/index.route')
app.use(cors())

//# routes
routeApiV1Admin(app)
routeApiV1(app)

app.listen(port, () => {
  console.log(`Start on PORT: ${port}`)
})
