const normalizeText = value => (typeof value === 'string' ? value.trim() : '')

const normalizeCode = value => {
  if (value === undefined || value === null) return ''
  return `${value}`.trim()
}

const formatStructuredAddress = payload => (
  [
    normalizeText(payload?.addressLine1),
    normalizeText(payload?.wardName),
    normalizeText(payload?.districtName),
    normalizeText(payload?.provinceName)
  ]
    .filter(Boolean)
    .join(', ')
)

const normalizeStructuredAddress = payload => {
  const legacyAddress = normalizeText(payload?.address)
  const provinceCode = normalizeCode(payload?.provinceCode)
  const provinceName = normalizeText(payload?.provinceName)
  const districtCode = normalizeCode(payload?.districtCode)
  const districtName = normalizeText(payload?.districtName)
  const wardCode = normalizeCode(payload?.wardCode)
  const wardName = normalizeText(payload?.wardName)
  const hasStructuredNames = Boolean(provinceName || districtName || wardName)
  const addressLine1 = normalizeText(payload?.addressLine1) || (!hasStructuredNames ? legacyAddress : '')
  const address = formatStructuredAddress({
    addressLine1,
    provinceName,
    districtName,
    wardName
  }) || legacyAddress

  return {
    addressLine1,
    provinceCode,
    provinceName,
    districtCode,
    districtName,
    wardCode,
    wardName,
    address
  }
}

const hasAnyStructuredAddressInput = payload => Boolean(
  normalizeText(payload?.addressLine1) ||
  normalizeCode(payload?.provinceCode) ||
  normalizeText(payload?.provinceName) ||
  normalizeCode(payload?.districtCode) ||
  normalizeText(payload?.districtName) ||
  normalizeCode(payload?.wardCode) ||
  normalizeText(payload?.wardName)
)

const hasCompleteStructuredAddress = payload => Boolean(
  normalizeText(payload?.addressLine1) &&
  normalizeCode(payload?.provinceCode) &&
  normalizeText(payload?.provinceName) &&
  normalizeCode(payload?.districtCode) &&
  normalizeText(payload?.districtName) &&
  normalizeCode(payload?.wardCode) &&
  normalizeText(payload?.wardName)
)

module.exports = {
  formatStructuredAddress,
  normalizeStructuredAddress,
  hasAnyStructuredAddressInput,
  hasCompleteStructuredAddress
}
