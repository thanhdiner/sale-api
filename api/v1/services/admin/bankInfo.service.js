const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const bankInfoRepository = require('../../repositories/bankInfo.repository')
const applyTranslation = require('../../utils/applyTranslation')

const BANK_INFO_TRANSLATION_FIELDS = ['bankName', 'accountHolder', 'noteTemplate']

const isTruthy = value => value === true || value === 'true' || value === 1 || value === '1'
const isFalsy = value => value === false || value === 'false' || value === 0 || value === '0'

function parseBoolean(value, fieldName) {
  if (typeof value === 'undefined' || value === '') return undefined
  if (isTruthy(value)) return true
  if (isFalsy(value)) return false
  throw new AppError(`${fieldName} is invalid`, 400)
}

function ensureValidObjectId(id, message = 'Invalid bank info ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeLanguage(lang) {
  return String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBankInfoTranslations(translations = {}) {
  let parsedTranslations = translations

  if (typeof translations === 'string') {
    try {
      parsedTranslations = JSON.parse(translations)
    } catch {
      parsedTranslations = {}
    }
  }

  const en = parsedTranslations?.en || {}

  return {
    en: {
      bankName: normalizeText(en.bankName),
      accountHolder: normalizeText(en.accountHolder),
      noteTemplate: normalizeText(en.noteTemplate)
    }
  }
}

function localizeBankInfo(bankInfo, lang) {
  return applyTranslation(bankInfo, normalizeLanguage(lang), BANK_INFO_TRANSLATION_FIELDS)
}

function normalizeWriteError(message, error) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(message, 400, error.message)
  }

  return error
}

function buildTextSearch(value) {
  const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { $regex: escapedValue, $options: 'i' }
}

function buildListQuery({ keyword = '', isActive = '' }) {
  const query = { isDeleted: false }
  const activeValue = parseBoolean(isActive, 'isActive')

  if (typeof activeValue === 'boolean') {
    query.isActive = activeValue
  }

  const trimmedKeyword = String(keyword || '').trim()
  if (!trimmedKeyword) {
    return query
  }

  const textSearch = buildTextSearch(trimmedKeyword)
  const isObjectId = trimmedKeyword.length === 24 && /^[a-fA-F0-9]{24}$/.test(trimmedKeyword)
  query.$or = [
    { bankName: textSearch },
    { 'translations.en.bankName': textSearch },
    { accountNumber: textSearch },
    { accountHolder: textSearch },
    { 'translations.en.accountHolder': textSearch },
    { noteTemplate: textSearch },
    { 'translations.en.noteTemplate': textSearch },
    ...(isObjectId ? [{ _id: trimmedKeyword }] : [])
  ]

  return query
}

async function getBankInfoByIdOrThrow(id, options = {}) {
  const {
    includeDeleted = false,
    message = 'Bank info not found'
  } = options

  ensureValidObjectId(id)

  const bankInfo = includeDeleted
    ? await bankInfoRepository.findById(id)
    : await bankInfoRepository.findByIdNotDeleted(id)

  if (!bankInfo) {
    throw new AppError(message, 404)
  }

  return bankInfo
}

async function listBankInfos(params = {}) {
  const pageNum = parseInt(params.page, 10) || 1
  const pageLimit = parseInt(params.limit, 10) || 20
  const query = buildListQuery(params)

  const total = await bankInfoRepository.countByQuery(query)
  const bankInfos = await bankInfoRepository.findByQuery(query, {
    sort: { isActive: -1, updatedAt: -1 },
    skip: (pageNum - 1) * pageLimit,
    limit: pageLimit
  })

  return { success: true, bankInfos, total }
}

async function getActiveBankInfo(lang = 'vi') {
  const bankInfo = await bankInfoRepository.findLatestActive()

  if (!bankInfo) {
    throw new AppError('No active bank info', 404)
  }

  return { success: true, bankInfo: localizeBankInfo(bankInfo, lang) }
}

async function createBankInfo(payload = {}, user = null) {
  const isActive = parseBoolean(payload.isActive, 'isActive')
  const createdById = user?.userId || user?.id || null

  try {
    if (isActive === true) {
      await bankInfoRepository.deactivateAll({})
    }

    const bankInfo = await bankInfoRepository.create({
      bankName: payload.bankName,
      accountNumber: payload.accountNumber,
      accountHolder: payload.accountHolder,
      noteTemplate: payload.noteTemplate,
      translations: normalizeBankInfoTranslations(payload.translations),
      qrCode: payload.qrCode,
      isActive: isActive ?? false,
      isDeleted: false,
      createdBy: createdById
        ? { account_id: String(createdById), createdAt: new Date() }
        : undefined
    })

    return { success: true, bankInfo }
  } catch (error) {
    throw normalizeWriteError('Failed to create bank info', error)
  }
}

async function updateBankInfo(id, payload = {}) {
  const bankInfo = await getBankInfoByIdOrThrow(id)
  const isActive = Object.prototype.hasOwnProperty.call(payload, 'isActive')
    ? parseBoolean(payload.isActive, 'isActive')
    : undefined

  try {
    if (isActive === true) {
      await bankInfoRepository.deactivateAll({ _id: { $ne: id } })
      bankInfo.isActive = true
    } else if (typeof isActive === 'boolean') {
      bankInfo.isActive = isActive
    }

    if (typeof payload.bankName === 'string') bankInfo.bankName = payload.bankName
    if (typeof payload.accountNumber === 'string') bankInfo.accountNumber = payload.accountNumber
    if (typeof payload.accountHolder === 'string') bankInfo.accountHolder = payload.accountHolder
    if (typeof payload.noteTemplate === 'string') bankInfo.noteTemplate = payload.noteTemplate
    if (Object.prototype.hasOwnProperty.call(payload, 'translations')) {
      bankInfo.translations = normalizeBankInfoTranslations(payload.translations)
    }
    if (typeof payload.qrCode === 'string') bankInfo.qrCode = payload.qrCode

    await bankInfo.save()

    return { success: true, bankInfo }
  } catch (error) {
    throw normalizeWriteError('Failed to update bank info', error)
  }
}

async function activateBankInfo(id, activeValue) {
  const bankInfo = await getBankInfoByIdOrThrow(id)
  const wantActive = parseBoolean(activeValue, 'active') ?? false

  if (wantActive) {
    await bankInfoRepository.deactivateAll({ _id: { $ne: id } })
    bankInfo.isActive = true
    await bankInfo.save()

    return { success: true, bankInfo }
  }

  const otherActive = await bankInfoRepository.countByQuery({
    _id: { $ne: id },
    isActive: true,
    isDeleted: false
  })

  if (otherActive === 0) {
    throw new AppError('At least one bank info must stay active', 400)
  }

  bankInfo.isActive = false
  await bankInfo.save()

  return { success: true, bankInfo }
}

async function deleteBankInfo(id, options = {}) {
  const { hard = false } = options
  const bankInfo = await getBankInfoByIdOrThrow(id, { includeDeleted: true })

  if (bankInfo.isActive) {
    const otherActive = await bankInfoRepository.countByQuery({
      _id: { $ne: id },
      isActive: true,
      isDeleted: false
    })

    if (otherActive === 0) {
      throw new AppError('At least one bank info must stay active', 400)
    }
  }

  if (hard) {
    await bankInfoRepository.deleteById(id)
    return { success: true, hardDeleted: true }
  }

  bankInfo.isDeleted = true
  bankInfo.isActive = false
  await bankInfo.save()

  return { success: true }
}

module.exports = {
  listBankInfos,
  getActiveBankInfo,
  createBankInfo,
  updateBankInfo,
  activateBankInfo,
  deleteBankInfo
}
