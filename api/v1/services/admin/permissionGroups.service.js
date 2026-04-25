const mongoose = require('mongoose')
const permissionGroupRepository = require('../../repositories/permissionGroup.repository')
const permissionRepository = require('../../repositories/permission.repository')
const AppError = require('../../utils/AppError')

function ensureValidObjectId(id, message = 'Permission group not found') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeWriteError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.code === 11000) {
    return new AppError('Group value already exists', 400)
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(error.message || fallbackMessage, 400)
  }

  return error
}

async function listPermissionGroups() {
  const permissionGroups = await permissionGroupRepository.findByQuery({ deleted: false })

  return { data: permissionGroups }
}

async function createPermissionGroup(payload = {}) {
  const { label, value, description, isActive } = payload

  if (!label || !value) {
    throw new AppError('Label, value are required', 400)
  }

  if (!/^[a-z0-9_]+$/.test(value)) {
    throw new AppError('Only a-z, 0-9, and _', 400)
  }

  const exists = await permissionGroupRepository.findOne({ value, deleted: false })
  if (exists) {
    throw new AppError('Group value already exists', 400)
  }

  try {
    const permissionGroup = await permissionGroupRepository.create({
      label,
      value,
      description,
      isActive
    })

    return {
      message: 'Created',
      data: permissionGroup
    }
  } catch (error) {
    throw normalizeWriteError(error, 'Created unsuccessful')
  }
}

async function editPermissionGroup(id, payload = {}) {
  ensureValidObjectId(id)

  const { label, description, isActive } = payload

  if (!label) {
    throw new AppError('Label is required', 400)
  }

  try {
    const updated = await permissionGroupRepository.updateById(
      id,
      { label, description, isActive }
    )

    if (!updated) {
      throw new AppError('Permission group not found', 404)
    }

    return {
      message: 'Updated',
      data: updated
    }
  } catch (error) {
    throw normalizeWriteError(error, 'Updated unsuccessful')
  }
}

async function deletePermissionGroup(id) {
  ensureValidObjectId(id)

  const group = await permissionGroupRepository.findById(id)
  if (!group || group.deleted) {
    throw new AppError('Permission group not found', 404)
  }

  const permissionCount = await permissionRepository.countByQuery({ group: group.value, deleted: false })
  if (permissionCount > 0) {
    throw new AppError(`Không thể xoá nhóm quyền vì còn ${permissionCount} permission liên kết!`, 400)
  }

  group.deleted = true
  await group.save()

  return { message: 'Permission group deleted successfully' }
}

async function togglePermissionGroupActive(id, isActive) {
  ensureValidObjectId(id)

  if (typeof isActive !== 'boolean') {
    throw new AppError('isActive is required and must be boolean', 400)
  }

  try {
    const updated = await permissionGroupRepository.updateById(id, { isActive })
    if (!updated) {
      throw new AppError('Permission group not found', 404)
    }

    return {
      message: 'Updated',
      data: updated
    }
  } catch (error) {
    throw normalizeWriteError(error, 'Updated unsuccessful')
  }
}

module.exports = {
  listPermissionGroups,
  createPermissionGroup,
  editPermissionGroup,
  deletePermissionGroup,
  togglePermissionGroupActive
}
