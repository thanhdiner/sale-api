const parseIntegerFields = (body, fields) => {
  fields.forEach(field => {
    if (body[field] !== undefined) body[field] = parseInt(body[field])
  })
}

module.exports = parseIntegerFields









