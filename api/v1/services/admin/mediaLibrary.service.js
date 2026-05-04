const AppError = require('../../utils/AppError')
const MediaAsset = require('../../models/mediaAsset.model')
const { deleteImageFromCloudinary, extractPublicId } = require('../../utils/cloudinaryUtils')

function getAdminId(user = null) {
  return user?.userId || user?.id || user?._id || null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).slice(0, 20)
  return normalizeText(value).split(',').map(normalizeText).filter(Boolean).slice(0, 20)
}

async function createAssetFromUpload(result = {}, file = {}, user = null) {
  if (!result.secure_url) return null
  return MediaAsset.create({
    url: result.secure_url,
    publicId: result.public_id || extractPublicId(result.secure_url) || '',
    resourceType: result.resource_type || 'image',
    mimeType: file.mimetype || '',
    size: file.size || result.bytes || 0,
    folder: result.folder || 'blog-content',
    createdBy: getAdminId(user)
  })
}

async function listAssets(params = {}) {
  const query = {}
  const keyword = normalizeText(params.keyword || params.search)
  if (params.resourceType) query.resourceType = params.resourceType
  if (keyword) query.$or = [
    { url: { $regex: keyword, $options: 'i' } },
    { alt: { $regex: keyword, $options: 'i' } },
    { tags: { $regex: keyword, $options: 'i' } }
  ]
  const data = await MediaAsset.find(query).sort({ createdAt: -1 }).limit(100).lean()
  return { message: 'Media assets fetched successfully', data }
}

async function updateAsset(id, payload = {}) {
  const asset = await MediaAsset.findById(id)
  if (!asset) throw new AppError('Media asset not found', 404)
  if (Object.prototype.hasOwnProperty.call(payload, 'alt')) asset.alt = normalizeText(payload.alt).slice(0, 180)
  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) asset.tags = normalizeTags(payload.tags)
  await asset.save()
  return { message: 'Media asset updated successfully', data: asset }
}

async function deleteAsset(id) {
  const asset = await MediaAsset.findById(id)
  if (!asset) throw new AppError('Media asset not found', 404)
  await deleteImageFromCloudinary(asset.url)
  await asset.deleteOne()
  return { message: 'Media asset deleted successfully' }
}

module.exports = { createAssetFromUpload, listAssets, updateAsset, deleteAsset }
