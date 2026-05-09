module.exports.extractPublicId = url => {
  try {
    const parts = url.split('/upload/')[1]
    const withFolder = parts.split('.')[0]
    const withoutVersion = withFolder.replace(/^v\d+\//, '')
    return withoutVersion
  } catch {
    return ''
  }
}









