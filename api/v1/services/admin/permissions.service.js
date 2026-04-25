const mongoose = require('mongoose')
const permissionRepository = require('../../repositories/permission.repository')
const AppError = require('../../utils/AppError')

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

async function listPermissions(params = {}) {
  const { group } = params
  const query = { deleted: false }

  if (group) {
    query.group = group
  }

  const permissions = await permissionRepository.findByQuery(query)

  return { data: permissions }
}

async function createPermission(payload = {}) {
  const { name, title, description, group } = payload

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

  const { title, description, group } = payload

  if (!title || !group) {
    throw new AppError('Title and group are required', 400)
  }

  try {
    const updated = await permissionRepository.updateById(
      id,
      { title, description, group }
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
