const homeBuildYourKitContentRepository = require('../../../repositories/cms/homeBuildYourKitContent.repository')
const { createSingletonContentModule } = require('../../../factories/singletonContent.factory')

const POSITION_KEYS = ['sunglasses', 'sunscreen', 'battery', 'camera', 'backpack', 'pillow', 'bottle', 'notebook']

const isObjectString = value => typeof value === 'string' && value.trim() === '[object Object]'
const cleanString = value => (typeof value === 'string' && !isObjectString(value) ? value.trim() : '')
const cleanText = value => (typeof value === 'string' && !isObjectString(value) ? value : '')
const cleanBoolean = value => value !== false
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const slugifyKitId = value => {
  const slug = cleanString(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || ''
}

const normalizeStringArray = value => {
  if (!Array.isArray(value)) return []
  return value.map(cleanString).filter(Boolean)
}

const normalizeLink = value => {
  const link = cleanString(value)
  if (!link) return ''
  if (link.startsWith('/') && !link.startsWith('//')) return link
  if (/^https?:\/\//i.test(link)) return link
  return ''
}

const normalizePositionKey = (value, index = 0) => {
  const key = cleanString(value).replace(/[^a-zA-Z0-9_-]/g, '')
  return key || POSITION_KEYS[index % POSITION_KEYS.length]
}

const normalizeProducts = value => {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => ({
      label: cleanString(item?.label || item?.customLabel),
      image: cleanString(item?.image || item?.customImage),
      className: normalizePositionKey(item?.className || item?.positionKey, index),
      positionKey: normalizePositionKey(item?.positionKey || item?.className, index),
      productId: cleanString(item?.productId),
      productSlug: cleanString(item?.productSlug),
      customLabel: cleanString(item?.customLabel),
      customImage: cleanString(item?.customImage),
      categorySlugFallback: cleanString(item?.categorySlugFallback)
    }))
    .filter(item => item.label || item.image || item.productId || item.productSlug || item.customLabel || item.customImage || item.categorySlugFallback)
    .slice(0, 8)
}

function createLegacyKit(payload = {}) {
  const label = cleanString(payload.activeScenario) || normalizeStringArray(payload.scenarios)[0] || ''

  return {
    id: slugifyKitId(label) || 'default-kit',
    label,
    kicker: cleanString(payload.activeCardKicker),
    title: cleanString(payload.activeCardTitle),
    description: cleanText(payload.activeCardDescription || payload.description),
    primaryCta: cleanString(payload.primaryCta),
    primaryCtaLink: normalizeLink(payload.primaryCtaLink),
    categorySlug: cleanString(payload.categorySlug),
    highlights: normalizeStringArray(payload.highlights),
    products: normalizeProducts(payload.products)
  }
}

function normalizeKitProducts(value) {
  return normalizeProducts(value).map(item => ({
    productId: item.productId,
    productSlug: item.productSlug,
    positionKey: item.positionKey,
    customLabel: item.customLabel || item.label,
    customImage: item.customImage || item.image,
    categorySlugFallback: item.categorySlugFallback
  }))
}

function normalizeKit(value = {}, index = 0) {
  const label = cleanString(value.label)
  const id = cleanString(value.id) || slugifyKitId(label) || `kit-${index + 1}`

  return {
    id,
    label,
    kicker: cleanString(value.kicker || value.activeCardKicker),
    title: cleanString(value.title || value.activeCardTitle),
    description: cleanText(value.description),
    primaryCta: cleanString(value.primaryCta),
    primaryCtaLink: normalizeLink(value.primaryCtaLink),
    categorySlug: cleanString(value.categorySlug),
    highlights: normalizeStringArray(value.highlights),
    products: normalizeKitProducts(value.products)
  }
}

function normalizeKits(payload = {}) {
  if (Array.isArray(payload.kits) && payload.kits.length) {
    const usedIds = new Set()

    return payload.kits
      .map((kit, index) => normalizeKit(kit, index))
      .filter(kit => kit.id && kit.label)
      .map((kit, index) => {
        if (!usedIds.has(kit.id)) {
          usedIds.add(kit.id)
          return kit
        }

        const uniqueId = `${kit.id}-${index + 1}`
        usedIds.add(uniqueId)
        return { ...kit, id: uniqueId }
      })
  }

  const legacyKit = createLegacyKit(payload)
  return legacyKit.label || legacyKit.title || legacyKit.products.length ? [legacyKit] : []
}

function normalizeContent(payload = {}) {
  const kits = normalizeKits(payload)
  const defaultKitId = cleanString(payload.defaultKitId)

  return {
    enabled: cleanBoolean(payload.enabled),
    eyebrow: cleanString(payload.eyebrow),
    title: cleanString(payload.title),
    description: cleanText(payload.description),
    defaultKitId: kits.some(kit => kit.id === defaultKitId) ? defaultKitId : kits[0]?.id || '',
    primaryCtaFallback: cleanString(payload.primaryCtaFallback || payload.primaryCta),
    secondaryCta: cleanString(payload.secondaryCta),
    secondaryCtaLink: normalizeLink(payload.secondaryCtaLink) || '/products',
    activeScenario: cleanString(payload.activeScenario || kits[0]?.label),
    activeCardKicker: cleanString(payload.activeCardKicker || kits[0]?.kicker),
    activeCardTitle: cleanString(payload.activeCardTitle || kits[0]?.title),
    primaryCta: cleanString(payload.primaryCta || kits[0]?.primaryCta),
    scenarios: normalizeStringArray(payload.scenarios).length ? normalizeStringArray(payload.scenarios) : kits.map(kit => kit.label),
    highlights: normalizeStringArray(payload.highlights).length ? normalizeStringArray(payload.highlights) : kits[0]?.highlights || [],
    products: normalizeProducts(payload.products).length ? normalizeProducts(payload.products) : kits[0]?.products || [],
    kits
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeContent(isPlainObject(translations.en) ? translations.en : {})
  }
}

const { service } = createSingletonContentModule({
  repository: homeBuildYourKitContentRepository,
  normalizeContent,
  normalizeTranslations,
  messages: {
    fetched: 'Home build your kit content fetched successfully',
    saved: 'Home build your kit content saved successfully'
  }
})

module.exports = {
  getHomeBuildYourKitContent: service.getAdminContent,
  updateHomeBuildYourKitContent: service.updateContent,
  normalizeContent,
  normalizeKits,
  normalizeKit,
  normalizeKitProducts,
  normalizeLink
}
