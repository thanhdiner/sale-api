const mongoose = require('mongoose')
const permissionRepository = require('../../../repositories/access/permission.repository')
const AppError = require('../../../utils/AppError')

function ensureValidObjectId(id, message = 'Permission not found') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeWriteError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.code === 11000) {
    return new AppError('Permission with this name already exists', 400)
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(error.message || fallbackMessage, 400)
  }

  return error
}

function buildTextSearch(value) {
  const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { $regex: escapedValue, $options: 'i' }
}

function normalizePermissionTranslations(translations = {}) {
  const englishTitle = translations?.en?.title
  const englishDescription = translations?.en?.description

  return {
    en: {
      title: typeof englishTitle === 'string' ? englishTitle.trim() : '',
      description: typeof englishDescription === 'string' ? englishDescription : ''
    }
  }
}

function normalizePermissionPayload(payload = {}) {
  const data = { ...payload }

  if (typeof data.name === 'string') {
    data.name = data.name.trim()
  }

  if (typeof data.title === 'string') {
    data.title = data.title.trim()
  }

  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    data.description = typeof data.description === 'string' ? data.description : ''
  }

  if (Object.prototype.hasOwnProperty.call(data, 'translations')) {
    data.translations = normalizePermissionTranslations(data.translations)
  }

  return data
}

const normalizeLanguage = language => (String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi')

const hasText = value => typeof value === 'string' && value.trim().length > 0

const toPlainObject = item => {
  if (!item) return item
  return item.toObject ? item.toObject() : { ...item }
}

function localizePermission(permission, languageInput) {
  const language = normalizeLanguage(languageInput)
  const plainPermission = toPlainObject(permission)

  if (!plainPermission) return plainPermission

  const translated = plainPermission.translations?.en || {}

  return {
    ...plainPermission,
    localizedTitle: language === 'en' && hasText(translated.title) ? translated.title : plainPermission.title,
    localizedDescription:
      language === 'en' && hasText(translated.description) ? translated.description : plainPermission.description
  }
}

async function listPermissions(params = {}) {
  const { group, search, language } = params
  const query = { deleted: false }

  if (group) {
    query.group = group
  }

  if (search) {
    const textSearch = buildTextSearch(search)
    query.$or = [
      { name: textSearch },
      { title: textSearch },
      { description: textSearch },
      { 'translations.en.title': textSearch },
      { 'translations.en.description': textSearch }
    ]
  }

  const permissions = await permissionRepository.findByQuery(query, {
    sort: { group: 1, name: 1 }
  })

  return { data: permissions.map(permission => localizePermission(permission, language)) }
}

async function createPermission(payload = {}) {
  const data = normalizePermissionPayload(payload)
  const { name, title, description, group, translations } = data

  if (!name || !title || !group) {
    throw new AppError('Name, title and group are required', 400)
  }

  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new AppError('Only a-z, 0-9, and _', 400)
  }

  const existingPermission = await permissionRepository.findOne({ name, deleted: false })
  if (existingPermission) {
    throw new AppError('Permission with this name already exists', 400)
  }

  try {
    const permission = await permissionRepository.create({
      name,
      title,
      description,
      translations,
      group
    })

    return {
      message: 'Created',
      data: permission
    }
  } catch (error) {
    throw normalizeWriteError(error, 'Created unsuccessful')
  }
}

async function editPermission(id, payload = {}) {
  ensureValidObjectId(id)

  const data = normalizePermissionPayload(payload)
  const { title, description, group, translations } = data

  if (!title || !group) {
    throw new AppError('Title and group are required', 400)
  }

  try {
    const updated = await permissionRepository.updateById(
      id,
      { title, description, group, translations }
    )

    if (!updated) {
      throw new AppError('Permission not found', 404)
    }

    return {
      message: 'Updated',
      data: updated
    }
  } catch (error) {
    throw normalizeWriteError(error, 'Updated unsuccessful')
  }
}

async function deletePermission(id) {
  ensureValidObjectId(id)

  const deleted = await permissionRepository.updateById(id, { deleted: true })
  if (!deleted) {
    throw new AppError('Permission not found', 404)
  }

  return {
    message: 'Deleted',
    data: deleted
  }
}

module.exports = {
  listPermissions,
  createPermission,
  editPermission,
  deletePermission
}












