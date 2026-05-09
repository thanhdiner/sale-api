const cache = require('../../../config/redis')
const logger = require('../../../config/logger')
const AppError = require('../utils/AppError')

const DEFAULT_CONTENT_TTL = 600
const DEFAULT_PAGE_TTL = 300
const SYSTEM_FIELDS = new Set([
  '_id',
  '__v',
  'key',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'translations'
])

const isObjectString = value => typeof value === 'string' && value.trim() === '[object Object]'
const cleanString = value => (typeof value === 'string' && !isObjectString(value) ? value.trim() : '')
const cleanText = value => (typeof value === 'string' && !isObjectString(value) ? value : '')
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const normalizeLanguage = language => (String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi')
const getUserId = user => user?.userId || user?.id || null

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}))
}

function toPlainObject(document) {
  if (!document) return document
  return typeof document.toObject === 'function' ? document.toObject() : document
}

function deepClean(value) {
  if (Array.isArray(value)) {
    return value.map(item => deepClean(item))
  }

  if (isPlainObject(value)) {
    return Object.keys(value).reduce((cleaned, key) => {
      cleaned[key] = deepClean(value[key])
      return cleaned
    }, {})
  }

  return typeof value === 'string' ? value.trim() : value
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (isPlainObject(value)) return Object.keys(value).length > 0
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null
}

function mergeLocalized(base, translated, options = {}) {
  if (Array.isArray(base) || Array.isArray(translated)) {
    const baseItems = Array.isArray(base) ? base : []
    const translatedItems = Array.isArray(translated) ? translated : []
    const length = Math.max(baseItems.length, translatedItems.length)
    const merged = Array.from({ length }, (_item, index) =>
      mergeLocalized(baseItems[index], translatedItems[index], options)
    )

    return options.arrayFilter === 'defined'
      ? merged.filter(item => item !== undefined)
      : merged.filter(item => hasValue(item))
  }

  if (isPlainObject(base) || isPlainObject(translated)) {
    const baseObject = isPlainObject(base) ? base : {}
    const translatedObject = isPlainObject(translated) ? translated : {}
    const keys = new Set([...Object.keys(baseObject), ...Object.keys(translatedObject)])

    return Array.from(keys).reduce((result, key) => {
      result[key] = mergeLocalized(baseObject[key], translatedObject[key], options)
      return result
    }, {})
  }

  return hasValue(translated) ? translated : base
}

function removeSystemFields(content = {}, extraFields = []) {
  const plainContent = toPlainObject(content) || {}
  const hiddenFields = new Set([...SYSTEM_FIELDS, ...extraFields])

  return Object.keys(plainContent).reduce((publicContent, key) => {
    if (!hiddenFields.has(key)) {
      publicContent[key] = plainContent[key]
    }

    return publicContent
  }, {})
}

function localizeFlatContent(content, language, options = {}) {
  if (!content) return null

  const plainContent = toPlainObject(content)
  const baseContent = removeSystemFields(plainContent, options.omitFields)

  if (normalizeLanguage(language) !== 'en') {
    return baseContent
  }

  return mergeLocalized(baseContent, plainContent.translations?.en || {}, {
    arrayFilter: options.arrayFilter || 'hasValue'
  })
}

function createSingletonRepository(Model, options = {}) {
  const {
    queryMode = 'singleton',
    defaultQuery = {},
    keyField = 'key',
    updateOptions = { new: true, runValidators: true }
  } = options

  const applyLean = (cursor, findOptions = {}) => (findOptions.lean ? cursor.lean() : cursor)

  async function findOne(first = {}, second = {}) {
    const query = queryMode === 'query' ? first : defaultQuery
    const findOptions = queryMode === 'query' ? second : first

    return applyLean(Model.findOne(query || {}), findOptions || {})
  }

  async function findByKey(key, findOptions = {}) {
    return applyLean(Model.findOne({ [keyField]: key }), findOptions || {})
  }

  async function create(payload = {}) {
    return Model.create(payload)
  }

  async function updateById(id, payload = {}) {
    return Model.findByIdAndUpdate(id, payload, updateOptions)
  }

  return {
    findOne,
    findByKey,
    create,
    updateById
  }
}

function resolveCacheKey(cacheKey, params) {
  if (!cacheKey) return null
  return typeof cacheKey === 'function' ? cacheKey(params) : cacheKey
}

async function readThroughCache(cacheKey, loader, ttl) {
  if (!cacheKey) return loader()
  return cache.getOrSet(cacheKey, loader, ttl)
}

async function clearCache(cachePattern, params) {
  const resolvedPattern = resolveCacheKey(cachePattern, params)
  if (resolvedPattern) {
    await cache.del(resolvedPattern)
  }
}

function createSingletonContentModule(options = {}) {
  const {
    model,
    repository: providedRepository,
    repositoryOptions,
    normalizeKey,
    keyField = 'key',
    normalizeContent,
    normalizeTranslations,
    messages = {},
    cacheKey,
    cachePattern,
    ttl = DEFAULT_CONTENT_TTL,
    publicOmitFields = []
  } = options

  const repository = providedRepository || createSingletonRepository(model, repositoryOptions)
  const contentNormalizer = normalizeContent || (payload => payload || {})
  const translationsNormalizer =
    normalizeTranslations ||
    (translations => ({
      en: contentNormalizer(translations?.en || {})
    }))

  const getKey = rawKey => (normalizeKey ? normalizeKey(rawKey) : undefined)
  const fetchContent = (key, findOptions = {}) =>
    normalizeKey ? repository.findByKey(key, findOptions) : repository.findOne(findOptions)

  async function getAdminContent(...args) {
    const key = getKey(args[0])

    return {
      message: messages.fetched || 'Content fetched successfully',
      data: await fetchContent(key, { lean: true })
    }
  }

  async function getClientContent(...args) {
    const key = normalizeKey ? getKey(args[0]) : undefined
    const language = normalizeKey ? args[1] : args[0]
    const normalizedLanguage = normalizeLanguage(language)
    const params = { key, language: normalizedLanguage }

    return readThroughCache(
      resolveCacheKey(cacheKey, params),
      async () => {
        const content = await fetchContent(key, { lean: true })

        return {
          message: messages.fetched || 'Content fetched successfully',
          data: localizeFlatContent(content, normalizedLanguage, {
            omitFields: publicOmitFields
          })
        }
      },
      ttl
    )
  }

  async function updateContent(...args) {
    const key = normalizeKey ? getKey(args[0]) : undefined
    const payload = (normalizeKey ? args[1] : args[0]) || {}
    const user = normalizeKey ? args[2] : args[1]
    const existingContent = await fetchContent(key)
    const userId = getUserId(user)
    const data = {
      ...(normalizeKey ? { [keyField]: key } : {}),
      ...contentNormalizer(payload),
      translations: translationsNormalizer(payload.translations),
      updatedBy: userId
    }

    const savedContent = existingContent
      ? await repository.updateById(existingContent._id, data)
      : await repository.create({
        ...data,
        createdBy: userId
      })

    await clearCache(cachePattern, { key })

    return {
      message: messages.saved || 'Content saved successfully',
      data: savedContent
    }
  }

  return {
    repository,
    service: {
      getAdminContent,
      getClientContent,
      updateContent
    }
  }
}

function createKeyedPageContentModule(options = {}) {
  const {
    model,
    repository: providedRepository,
    repositoryOptions = { queryMode: 'query' },
    key,
    keyField = 'key',
    defaultContent = {},
    defaultTranslations = { en: {} },
    normalizeContent,
    normalizeTranslations,
    messages = {},
    requiredMessage = 'Content is required',
    cacheKey,
    cachePattern,
    ttl = DEFAULT_PAGE_TTL
  } = options

  const repository = providedRepository || createSingletonRepository(model, repositoryOptions)
  const contentNormalizer = normalizeContent || (content => (isPlainObject(content) ? deepClean(content) : {}))
  const translationsNormalizer =
    normalizeTranslations ||
    (translations => ({
      en: isPlainObject(translations?.en) ? deepClean(translations.en) : {}
    }))

  async function getOrCreateContent() {
    const query = { [keyField]: key }
    const existingContent = await repository.findOne(query)
    if (existingContent) return existingContent

    try {
      return await repository.create({
        [keyField]: key,
        content: clone(defaultContent),
        translations: clone(defaultTranslations)
      })
    } catch (error) {
      if (error?.code === 11000) {
        return repository.findOne(query)
      }

      throw error
    }
  }

  function mapAdminData(document) {
    const plainDocument = toPlainObject(document)

    return {
      ...plainDocument,
      content: contentNormalizer(plainDocument?.content),
      translations: translationsNormalizer(plainDocument?.translations)
    }
  }

  async function getAdminContent() {
    const content = await getOrCreateContent()

    return {
      message: messages.fetched || 'Content fetched successfully',
      data: mapAdminData(content)
    }
  }

  async function getClientContent(language = 'vi') {
    const normalizedLanguage = normalizeLanguage(language)

    return readThroughCache(
      resolveCacheKey(cacheKey, { language: normalizedLanguage }),
      async () => {
        const content = await getOrCreateContent()
        const data = mapAdminData(content)
        const localizedContent =
          normalizedLanguage === 'en'
            ? mergeLocalized(data.content, data.translations.en, { arrayFilter: 'defined' })
            : data.content

        return {
          message: messages.fetched || 'Content fetched successfully',
          data: localizedContent
        }
      },
      ttl
    )
  }

  async function updateContent(payload = {}, user = null) {
    if (!isPlainObject(payload.content)) {
      throw new AppError(requiredMessage, 400)
    }

    const content = await getOrCreateContent()
    content.content = contentNormalizer(payload.content)
    content.translations = translationsNormalizer(payload.translations)
    content.updatedBy = getUserId(user)

    await content.save()
    await clearCache(cachePattern)

    return {
      message: messages.updated || messages.saved || 'Content updated successfully',
      data: mapAdminData(content)
    }
  }

  return {
    repository,
    service: {
      getOrCreateContent,
      getAdminContent,
      getClientContent,
      updateContent
    }
  }
}

function createControllerAction(options = {}) {
  const {
    handler,
    logMessage,
    errorMessage,
    errorShape = 'message',
    handleKnownErrors = false
  } = options

  return async (req, res) => {
    try {
      const result = await handler(req)
      res.status(200).json(result)
    } catch (error) {
      if (handleKnownErrors && error?.statusCode) {
        res.status(error.statusCode).json({ success: false, message: error.message })
        return
      }

      logger.error(logMessage, error)
      res.status(500).json(
        errorShape === 'error'
          ? { error: errorMessage }
          : { success: false, message: errorMessage }
      )
    }
  }
}

module.exports = {
  cleanString,
  cleanText,
  clone,
  createControllerAction,
  createKeyedPageContentModule,
  createSingletonContentModule,
  createSingletonRepository,
  deepClean,
  hasValue,
  isPlainObject,
  localizeFlatContent,
  mergeLocalized,
  normalizeLanguage,
  removeSystemFields,
  toPlainObject
}









