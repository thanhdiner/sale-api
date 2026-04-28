const parseJsonBodyField = (body, fieldName) => {
  if (!body || typeof body[fieldName] !== 'string') return

  try {
    body[fieldName] = JSON.parse(body[fieldName])
  } catch {
    body[fieldName] = {}
  }
}

module.exports = parseJsonBodyField
