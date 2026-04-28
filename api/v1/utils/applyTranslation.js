const hasValue = value => {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' && value.trim().length > 0
}

const toPlainObject = item => {
  if (!item) return item
  return item.toObject ? item.toObject() : { ...item }
}

const applyTranslation = (item, lang, fields = []) => {
  if (!item || lang !== 'en') return toPlainObject(item)

  const obj = toPlainObject(item)
  const translated = obj.translations?.[lang]

  if (!translated) return obj

  fields.forEach(field => {
    if (hasValue(translated[field])) {
      obj[field] = translated[field]
    }
  })

  return obj
}

module.exports = applyTranslation
