const getRequestLanguage = req => {
  const lang = req.query?.lang || req.get('Accept-Language')
  return String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

module.exports = getRequestLanguage









