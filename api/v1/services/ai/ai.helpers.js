const logger = require('../../../../config/logger')

const SUGGESTION_BULLET_PATTERN = /^[-\u2022\u25BA\u25B8]\s/

function extractTextFromContent(content) {
  if (!Array.isArray(content)) return ''

  return content
    .filter(part => part && part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join(' ')
}

function normalizeUserMessage(userMessage) {
  if (userMessage && typeof userMessage === 'object') {
    const promptInput = Array.isArray(userMessage.content) && userMessage.content.length > 0
      ? userMessage.content
      : (userMessage.promptText || userMessage.text || '')
    const promptText = typeof userMessage.promptText === 'string'
      ? userMessage.promptText
      : (typeof userMessage.text === 'string'
        ? userMessage.text
        : extractTextFromContent(promptInput))
    const memoryInput = typeof userMessage.memoryText === 'string'
      ? userMessage.memoryText
      : (promptText || extractTextFromContent(promptInput))

    return {
      promptInput,
      promptText,
      memoryInput
    }
  }

  const promptText = typeof userMessage === 'string' ? userMessage : ''
  return {
    promptInput: promptText,
    promptText,
    memoryInput: promptText
  }
}

function parseFailedGeneration(text) {
  try {
    const source = String(text || '')
    const match = source.match(/<function=(\w+)\s*(\{.*?\})\s*>?\s*<\/function>/s)
    if (!match) {
      logger.warn(`[AI] Could not parse failed_generation: ${source}`)
      return null
    }

    const name = match[1]
    let args = {}

    try {
      args = JSON.parse(match[2])
    } catch {
      args = JSON.parse(match[2].replace(/'/g, '"').trim())
    }

    return { name, args }
  } catch (err) {
    logger.warn(`[AI] parseFailedGeneration error: ${err.message}`)
    return null
  }
}

function extractSuggestions(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => SUGGESTION_BULLET_PATTERN.test(line) && line.length < 60 && line.length > 3)
    .map(line => line.replace(SUGGESTION_BULLET_PATTERN, '').trim())
    .filter(line => line && !line.endsWith(':'))
    .slice(-3)
}

function removeSuggestionLines(text) {
  const lines = String(text || '').split('\n')
  const suggestionIndexes = []
  const contentLines = []
  let inSuggestionBlock = false

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmed = lines[index].trim()
    if (SUGGESTION_BULLET_PATTERN.test(trimmed) && trimmed.length < 60) {
      inSuggestionBlock = true
      suggestionIndexes.unshift(index)
      continue
    }

    if (inSuggestionBlock) {
      if (/(gợi ý|bạn có thể hỏi|câu hỏi)/i.test(trimmed)) {
        suggestionIndexes.unshift(index)
      }
      break
    }

    break
  }

  if (suggestionIndexes.length === 0) {
    return String(text || '').trim()
  }

  const removeSet = new Set(suggestionIndexes)
  for (let index = 0; index < lines.length; index += 1) {
    if (!removeSet.has(index)) {
      contentLines.push(lines[index])
    }
  }

  return contentLines.join('\n').trim()
}

module.exports = {
  extractTextFromContent,
  normalizeUserMessage,
  parseFailedGeneration,
  extractSuggestions,
  removeSuggestionLines
}
