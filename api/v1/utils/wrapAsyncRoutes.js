const asyncHandler = require('./asyncHandler')

const wrapLayerHandle = layer => {
  if (!layer || !layer.handle || layer.handle._asyncWrapped) return
  if (layer.handle.length > 3) return

  layer.handle = asyncHandler(layer.handle)
  layer.handle._asyncWrapped = true
}

const wrapStack = stack => {
  if (!Array.isArray(stack)) return

  stack.forEach(layer => {
    if (layer.route?.stack) {
      wrapStack(layer.route.stack)
      return
    }

    if (layer.handle?.stack) {
      wrapStack(layer.handle.stack)
      return
    }

    wrapLayerHandle(layer)
  })
}

const wrapAsyncRoutes = appOrRouter => {
  wrapStack(appOrRouter?._router?.stack || appOrRouter?.stack)
}

module.exports = wrapAsyncRoutes
