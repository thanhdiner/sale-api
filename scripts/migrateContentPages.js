const path = require('path')
const mongoose = require('mongoose')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const ContentPage = require('../api/v1/models/contentPage.model')

const DRY_RUN = !process.argv.includes('--write')
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

const FLAT_COLLECTIONS = [
  { key: 'about', collectionName: 'about_contents' },
  { key: 'cooperationContact', collectionName: 'cooperation_contact_contents' },
  { key: 'homeWhyChooseUs', collectionName: 'home_why_choose_us_contents' },
  { key: 'terms', collectionName: 'terms_contents' },
  { key: 'vip', collectionName: 'vip_contents' },
  { key: 'gameNews', collectionName: 'game_news_contents' },
  { key: 'gameAccount', collectionName: 'game_account_contents' }
]

const KEYED_COLLECTIONS = [
  { collectionName: 'contactPages' },
  { collectionName: 'faqPages' },
  { collectionName: 'footerContents' },
  { collectionName: 'privacyPolicyPages' },
  { collectionName: 'returnPolicyPages' }
]

const COMING_SOON_COLLECTION = {
  collectionName: 'coming_soon_contents',
  query: {}
}

function compact(value = {}) {
  return Object.keys(value).reduce((result, key) => {
    if (value[key] !== undefined) {
      result[key] = value[key]
    }

    return result
  }, {})
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toPlainObject(document) {
  if (!document) return document
  return typeof document.toObject === 'function' ? document.toObject() : document
}

function normalizeTranslations(translations) {
  return isPlainObject(translations) ? translations : {}
}

function buildFlatContent(plainDocument) {
  return Object.keys(plainDocument).reduce((result, key) => {
    if (!FLAT_SYSTEM_FIELDS.has(key)) {
      result[key] = plainDocument[key]
    }

    return result
  }, {})
}

function buildContentPagePayload(key, legacyDocument, mode) {
  const plainDocument = toPlainObject(legacyDocument) || {}
  const basePayload = {
    key,
    content:
      mode === 'flat'
        ? buildFlatContent(plainDocument)
        : isPlainObject(plainDocument.content)
          ? plainDocument.content
          : {},
    translations: normalizeTranslations(plainDocument.translations),
    createdBy: plainDocument.createdBy || null,
    updatedBy: plainDocument.updatedBy || null,
    createdAt: plainDocument.createdAt,
    updatedAt: plainDocument.updatedAt
  }

  return compact(basePayload)
}

async function readCollection(collectionName, query = {}) {
  return ContentPage.db.collection(collectionName).find(query).toArray()
}

async function upsertContentPage(payload) {
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
  const safeUpdate = Object.keys(update).reduce((result, operator) => {
    if (Object.keys(update[operator]).length > 0) {
      result[operator] = update[operator]
    }

    return result
  }, {})

  await ContentPage.updateOne({ key: payload.key }, safeUpdate, {
    runValidators: true,
    setDefaultsOnInsert: true,
    timestamps: false,
    upsert: true
  })
}

async function migrateCollection(entry) {
  const documents = await readCollection(entry.collectionName, entry.query || {})

  if (documents.length === 0) {
    console.log(`[skip] ${entry.collectionName} -> no documents`)
    return
  }

  console.log(`[scan] ${entry.collectionName} -> ${documents.length} document(s)`)

  for (const document of documents) {
    const key = entry.key || document.key

    if (!key) {
      console.log(`  [skip] missing key in ${entry.collectionName}`)
      continue
    }

    const payload = buildContentPagePayload(key, document, entry.mode)

    if (DRY_RUN) {
      console.log(`  [dry-run] ${key}`)
      continue
    }

    await upsertContentPage(payload)
    console.log(`  [migrated] ${key}`)
  }
}

async function main() {
  if (!process.env.MONGO_URL) {
    throw new Error('Missing MONGO_URL in sales-api/.env')
  }

  await mongoose.connect(process.env.MONGO_URL)

  for (const entry of FLAT_COLLECTIONS) {
    await migrateCollection({
      ...entry,
      mode: 'flat'
    })
  }

  await migrateCollection({
    ...COMING_SOON_COLLECTION,
    mode: 'flat'
  })

  for (const entry of KEYED_COLLECTIONS) {
    await migrateCollection({
      ...entry,
      mode: 'native'
    })
  }

  console.log(DRY_RUN ? 'Dry run completed' : 'Migration completed')
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
