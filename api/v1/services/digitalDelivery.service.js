const ProductCredential = require('../models/productCredential.model')
const Product = require('../models/products.model')
const AppError = require('../utils/AppError')
const { decryptCredential } = require('../utils/digitalCredentialCrypto')
const cache = require('../../../config/redis')

const PRODUCT_CACHE_PATTERNS = [
  'products:list:*',
  'products:detail:*',
  'products:suggest:*',
  'products:recommendations:*',
  'products:explore-more:*',
  'categories:slug:*',
  'dashboard:*'
]

function invalidateProductCaches() {
  cache.del(...PRODUCT_CACHE_PATTERNS).catch(() => {})
}

async function syncProductStock(productId, { invalidateCache = true } = {}) {
  const availableCount = await ProductCredential.countDocuments({ productId, status: 'available' })
  await Product.updateOne(
    { _id: productId, deliveryType: 'instant_account' },
    { $set: { stock: availableCount } }
  )
  if (invalidateCache) {
    invalidateProductCaches()
  }
  return availableCount
}

async function reserveCredentialIdsForItem(order, item, quantity = item.quantity) {
  const credentialIds = []

  try {
    for (let index = 0; index < quantity; index += 1) {
      const credential = await ProductCredential.findOneAndUpdate(
        { productId: item.productId, status: 'available' },
        {
          $set: {
            status: 'reserved',
            reservedByOrderId: order._id,
            reservedAt: new Date()
          }
        },
        { new: true, sort: { createdAt: 1 } }
      )

      if (!credential) {
        throw new AppError(`Sản phẩm ${item.name} không đủ tài khoản trong kho`, 400)
      }

      credentialIds.push(credential._id)
    }

    await syncProductStock(item.productId)
    return credentialIds
  } catch (error) {
    if (credentialIds.length) {
      await ProductCredential.updateMany(
        { _id: { $in: credentialIds }, status: 'reserved', reservedByOrderId: order._id },
        {
          $set: { status: 'available' },
          $unset: { reservedByOrderId: '', reservedAt: '' }
        }
      )
      await syncProductStock(item.productId)
    }

    throw error
  }
}

async function reserveCredentialsForOrder(order, orderItems = []) {
  const reservedCredentialIds = []

  try {
    for (let index = 0; index < orderItems.length; index += 1) {
      const item = orderItems[index]
      if (item.deliveryType !== 'instant_account') continue

      const credentials = await reserveCredentialIdsForItem(order, item)
      reservedCredentialIds.push(...credentials)

      const orderItem = order.orderItems[index]
      if (orderItem) {
        orderItem.credentialIds = credentials
      }
    }

    return reservedCredentialIds
  } catch (error) {
    if (reservedCredentialIds.length) {
      await ProductCredential.updateMany(
        { _id: { $in: reservedCredentialIds }, status: 'reserved' },
        {
          $set: { status: 'available' },
          $unset: { reservedByOrderId: '', reservedAt: '' }
        }
      )
      await Promise.all(orderItems.filter(item => item.deliveryType === 'instant_account').map(item => syncProductStock(item.productId)))
    }

    throw error
  }
}

function buildDeliverySnapshot(credential, productInstructions = '') {
  const data = decryptCredential(credential.credential)
  return {
    credentialId: credential._id,
    username: data.username || '',
    password: data.password || '',
    email: data.email || '',
    licenseKey: data.licenseKey || '',
    loginUrl: data.loginUrl || '',
    notes: data.notes || '',
    instructions: productInstructions || data.instructions || '',
    deliveredAt: new Date()
  }
}

async function finalizeOrderDelivery(order) {
  let changed = false

  for (const item of order.orderItems || []) {
    if (item.deliveryType !== 'instant_account' || item.digitalDeliveries?.length) {
      continue
    }

    if (!item.credentialIds?.length) {
      item.credentialIds = await reserveCredentialIdsForItem(order, item)
    }

    if (item.credentialIds.length !== item.quantity) {
      throw new AppError(`Dữ liệu bàn giao cho ${item.name} không hợp lệ`, 400)
    }

    const credentials = await ProductCredential.find({
      _id: { $in: item.credentialIds },
      status: 'reserved',
      reservedByOrderId: order._id
    })

    if (credentials.length !== item.credentialIds.length) {
      throw new AppError(`Dữ liệu bàn giao cho ${item.name} không hợp lệ`, 400)
    }

    item.digitalDeliveries = credentials.map(credential => buildDeliverySnapshot(credential, item.deliveryInstructions))

    await ProductCredential.updateMany(
      { _id: { $in: item.credentialIds }, status: 'reserved', reservedByOrderId: order._id },
      {
        $set: {
          status: 'sold',
          soldToOrderId: order._id,
          soldAt: new Date()
        }
      }
    )

    await Product.updateOne(
      { _id: item.productId, deliveryType: 'instant_account' },
      { $inc: { soldQuantity: credentials.length } }
    )

    await syncProductStock(item.productId)
    changed = true
  }

  if (changed) {
    order.hasDigitalDelivery = true
  }

  return changed
}

async function releaseOrderReservations(order) {
  const credentialIds = (order.orderItems || []).flatMap(item => item.credentialIds || [])
  if (!credentialIds.length) return

  const reservedCredentials = await ProductCredential.find({
    _id: { $in: credentialIds },
    status: 'reserved',
    reservedByOrderId: order._id
  }).select('_id productId').lean()

  if (!reservedCredentials.length) return

  const releasedCredentialIds = reservedCredentials.map(credential => credential._id)
  const releasedCredentialIdSet = new Set(releasedCredentialIds.map(String))

  await ProductCredential.updateMany(
    { _id: { $in: releasedCredentialIds }, status: 'reserved', reservedByOrderId: order._id },
    {
      $set: { status: 'available' },
      $unset: { reservedByOrderId: '', reservedAt: '' }
    }
  )

  for (const item of order.orderItems || []) {
    if (item.deliveryType === 'instant_account') {
      item.credentialIds = (item.credentialIds || []).filter(credentialId => !releasedCredentialIdSet.has(String(credentialId)))
    }
  }

  const productIds = [...new Set(reservedCredentials.map(credential => String(credential.productId)))]
  await Promise.all(productIds.map(syncProductStock))
}

module.exports = {
  syncProductStock,
  reserveCredentialsForOrder,
  finalizeOrderDelivery,
  releaseOrderReservations,
  invalidateProductCaches
}
