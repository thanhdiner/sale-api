const ContentPage = require('../../models/cms/contentPage.model')
const {
  createSingletonRepository,
  isPlainObject,
  toPlainObject
} = require('../../factories/singletonContent.factory')

const DEFAULT_UPDATE_OPTIONS = { new: true, runValidators: true }
const FIND_OPTION_KEYS = new Set(['lean', 'projection', 'select', 'sort'])
const FLAT_SYSTEM_FIELDS = new Set([
  '_id',
  '__v',
  'key',
  'content',
  'translations',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy'
])

function compact(value = {}) {
  return Object.keys(value).reduce((result, key) => {
    if (value[key] !== undefined) {
      result[key] = value[key]
    }

    return result
  }, {})
}

function looksLikeFindOptions(value) {
  return isPlainObject(value) && Object.keys(value).some(key => FIND_OPTION_KEYS.has(key))
}

function normalizeTranslations(translations) {
  return isPlainObject(translations) ? translations : {}
}

function extractMetadata(payload = {}) {
  const plainPayload = toPlainObject(payload) || {}

  return compact({
    createdBy: plainPayload.createdBy,
    updatedBy: plainPayload.updatedBy,
    createdAt: plainPayload.createdAt,
    updatedAt: plainPayload.updatedAt
  })
}

function createStoredPayload(key, payload = {}) {
  const plainPayload = toPlainObject(payload) || {}

  return {
    key: plainPayload.key || key,
    content: isPlainObject(plainPayload.content) ? plainPayload.content : {},
    translations: normalizeTranslations(plainPayload.translations),
    ...extractMetadata(plainPayload)
  }
}

function createStoredFlatPayload(key, payload = {}) {
  const plainPayload = toPlainObject(payload) || {}
  const content = Object.keys(plainPayload).reduce((result, field) => {
    if (!FLAT_SYSTEM_FIELDS.has(field)) {
      result[field] = plainPayload[field]
    }

    return result
  }, {})

  return {
    key: plainPayload.key || key,
    content,
    translations: normalizeTranslations(plainPayload.translations),
    ...extractMetadata(plainPayload)
  }
}

function toLeanIfNeeded(document, findOptions = {}) {
  if (!document) return document
  return findOptions.lean ? toPlainObject(document) : document
}

function flattenContentPage(document, options = {}) {
  const plainDocument = toPlainObject(document)
  if (!plainDocument) return plainDocument

  const content = isPlainObject(plainDocument.content) ? plainDocument.content : {}
  const flattened = {
    ...content,
    translations: normalizeTranslations(plainDocument.translations),
    _id: plainDocument._id,
    createdBy: plainDocument.createdBy,
    updatedBy: plainDocument.updatedBy,
    createdAt: plainDocument.createdAt,
    updatedAt: plainDocument.updatedAt,
    __v: plainDocument.__v
  }

  if (options.exposeKey) {
    flattened.key = plainDocument.key
  }

  return flattened
}

function buildLegacyQuery(legacy = {}, key) {
  if (typeof legacy.query === 'function') {
    return legacy.query(key)
  }

  if (legacy.query) {
    return legacy.query
  }

  return key ? { key } : {}
}

async function findLegacyDocument(legacy = {}, key) {
  if (!legacy.collectionName) return null

  return ContentPage.db
    .collection(legacy.collectionName)
    .findOne(buildLegacyQuery(legacy, key))
}

function buildUpdate(payload = {}) {
  const update = {
    $set: compact({
      key: payload.key,
      content: payload.content,
      translations: payload.translations,
      updatedBy: payload.updatedBy,
      updatedAt: payload.updatedAt
    }),
    $setOnInsert: compact({
      createdBy: payload.createdBy,
      createdAt: payload.createdAt
    })
  }

  return Object.keys(update).reduce((result, operator) => {
    if (Object.keys(update[operator]).length > 0) {
      result[operator] = update[operator]
    }

    return result
  }, {})
}

async function upsertContentPage(payload = {}) {
  const query = { key: payload.key }
  const update = buildUpdate(payload)

  try {
    return await ContentPage.findOneAndUpdate(query, update, {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      timestamps: false,
      upsert: true
    })
  } catch (error) {
    if (error?.code === 11000) {
      return ContentPage.findOne(query)
    }

    throw error
  }
}

function createContentPageRepository(options = {}) {
  const { legacy } = options
  const baseRepository = createSingletonRepository(ContentPage, {
    queryMode: 'query',
    updateOptions: DEFAULT_UPDATE_OPTIONS
  })

  async function findOne(query = {}, findOptions = {}) {
    const contentPage = await baseRepository.findOne(query, findOptions)
    if (contentPage || !query?.key) return contentPage

    const legacyDocument = await findLegacyDocument(legacy, query.key)
    if (!legacyDocument) return null

    const migratedContentPage = await upsertContentPage(
      createStoredPayload(query.key, legacyDocument)
    )

    return toLeanIfNeeded(migratedContentPage, findOptions)
  }

  async function findByKey(key, findOptions = {}) {
    return findOne({ key }, findOptions)
  }

  async function create(payload = {}) {
    return ContentPage.create(createStoredPayload(payload.key, payload))
  }

  async function updateById(id, payload = {}) {
    return ContentPage.findByIdAndUpdate(
      id,
      createStoredPayload(payload.key, payload),
      DEFAULT_UPDATE_OPTIONS
    )
  }

  return {
    findOne,
    findByKey,
    create,
    updateById
  }
}

function createFlatContentPageRepository(defaultKey, options = {}) {
  const { exposeKey = false, legacy } = options

  async function findByResolvedKey(key) {
    if (!key) return null

    const contentPage = await ContentPage.findOne({ key })
    if (contentPage) {
      return flattenContentPage(contentPage, { exposeKey })
    }

    const legacyDocument = await findLegacyDocument(legacy, key)
    if (!legacyDocument) return null

    const migratedContentPage = await upsertContentPage(
      createStoredFlatPayload(key, legacyDocument)
    )

    return flattenContentPage(migratedContentPage, { exposeKey })
  }

  async function findOne(first = {}, second = {}) {
    const findOptions = looksLikeFindOptions(first) ? first : second
    const key = defaultKey || first?.key

    return findByResolvedKey(key, findOptions)
  }

  async function findByKey(key, findOptions = {}) {
    return findByResolvedKey(key, findOptions)
  }

  async function create(payload = {}) {
    const contentPage = await ContentPage.create(
      createStoredFlatPayload(payload.key || defaultKey, payload)
    )

    return flattenContentPage(contentPage, { exposeKey })
  }

  async function updateById(id, payload = {}) {
    const key = payload.key || defaultKey
    const storedPayload = createStoredFlatPayload(key, payload)
    const contentPage = await ContentPage.findByIdAndUpdate(
      id,
      storedPayload,
      DEFAULT_UPDATE_OPTIONS
    )

    if (contentPage) {
      return flattenContentPage(contentPage, { exposeKey })
    }

    const upsertedContentPage = await upsertContentPage(storedPayload)

    return flattenContentPage(upsertedContentPage, { exposeKey })
  }

  return {
    findOne,
    findByKey,
    create,
    updateById
  }
}

module.exports = {
  createContentPageRepository,
  createFlatContentPageRepository
}










