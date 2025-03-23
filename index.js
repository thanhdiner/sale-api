const express = require('express')
const database = require('./config/database')
const app = express()
require('dotenv').config()
const port = process.env.PORT

database.connect()

const routeApiV1 = require('./api/v1/routes/index')

routeApiV1(app)

app.listen(port, () => {
  console.log(`Start on PORT: ${port}`)
})
