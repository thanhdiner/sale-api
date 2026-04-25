const mongoose = require('mongoose')
const roleRepository = require('../../repositories/role.repository')
const AppError = require('../../utils/AppError')

function ensureValidObjectId(id, message = 'Role not found') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeWriteError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(error.message || fallbackMessage, 400)
  }

  return error
}

async function listRoles() {
  const roles = await roleRepository.findByQuery({ deleted: false })
  return { data: roles }
}

async function createRole(payload = {}) {
  const { label, description, permissions = [], isActive } = payload

  if (!label) {
    throw new AppError('Role name (label) is required', 400)
  }

  const exists = await roleRepository.findOne({ label, deleted: false })
  if (exists) {
    throw new AppError('Role name (label) already exists', 400)
  }

  try {
    const role = await roleRepository.create({
      label,
      description,
      permissions,
      isActive
    })

    return { message: 'Created', data: role }
  } catch (error) {
    throw normalizeWriteError(error, 'Created unsuccessful')
  }
}

async function editRole(id, payload = {}) {
  ensureValidObjectId(id)

  const { label, description, permissions, isActive } = payload

  if (!label) {
    throw new AppError('Role name (label) is required', 400)
  }

  const exists = await roleRepository.findOne({ label, _id: { $ne: id }, deleted: false })
  if (exists) {
    throw new AppError('Role name (label) already exists', 400)
  }

  try {
    const updated = await roleRepository.updateById(id, { label, description, permissions, isActive })
    if (!updated) {
      throw new AppError('Role group not found', 404)
    }

    return { message: 'Updated', data: updated }
  } catch (error) {
    throw normalizeWriteError(error, 'Updated unsuccessful')
  }
}

async function deleteRole(id) {
  ensureValidObjectId(id)

  const deleted = await roleRepository.updateById(id, { deleted: true })
  if (!deleted) {
    throw new AppError('Role not found', 404)
  }

  return { message: 'Role deleted!', data: deleted }
}

async function toggleRoleActive(id) {
  ensureValidObjectId(id)

  const role = await roleRepository.findById(id)
  if (!role) {
    throw new AppError('Role not found', 404)
  }

  role.isActive = !role.isActive
  await role.save()

  return { message: 'Toggled status', data: role }
}

module.exports = {
  listRoles,
  createRole,
  editRole,
  deleteRole,
  toggleRoleActive
}
