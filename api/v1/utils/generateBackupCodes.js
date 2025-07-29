const generateBackupCodes = async (count = 10) => {
  return Array.from({ length: count }, () => ({
    code: `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    used: false
  }))
}

module.exports = generateBackupCodes
