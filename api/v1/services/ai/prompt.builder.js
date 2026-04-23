/**
 * Prompt Builder — Xay dung system prompt cho AI chatbot
 * Ket hop brand voice, FAQ, policies va tool registry runtime.
 */

const knowledgeLoader = require('./knowledge.loader')

function formatToolList(availableTools = []) {
  if (!Array.isArray(availableTools) || availableTools.length === 0) {
    return '- Hien tai khong co tool nao duoc bat. Chi duoc tra loi trong pham vi kien thuc san co va moi chuyen nhan vien khi can.'
  }

  return availableTools
    .filter(tool => tool?.enabled)
    .map(tool => `- ${tool.name}: ${tool.description}`)
    .join('\n')
}

function formatSystemRules(systemRules = []) {
  if (!Array.isArray(systemRules) || systemRules.length === 0) {
    return '- Neu khong chac chan, noi ro gioi han va de nghi chuyen nhan vien.'
  }

  return systemRules.map(rule => `- ${rule}`).join('\n')
}

/**
 * Build system prompt day du cho chatbot
 * @param {Object} options
 * @param {Object} options.customerInfo - Thong tin khach hang
 * @param {string} options.customPrompt - Override system prompt
 * @returns {string} System prompt
 */
function buildSystemPrompt(options = {}) {
  const {
    customerInfo = {},
    customPrompt,
    brandVoice,
    agentName = 'Trợ lý mua hàng',
    agentRole = 'Hỗ trợ tìm sản phẩm và tư vấn mua sắm',
    agentTone = 'Thân thiện, ngắn gọn',
    systemRules = [],
    availableTools = []
  } = options

  if (customPrompt && customPrompt.trim()) {
    return customPrompt
  }

  const kb = knowledgeLoader.loadKnowledge()

  const customerContext = customerInfo.name
    ? `Khach hang hien tai: ${customerInfo.name}${customerInfo.userId ? ' (da dang nhap)' : ' (chua dang nhap)'}`
    : 'Khach hang chua dang nhap.'

  const currentPage = customerInfo.currentPage
    ? `Khach dang xem trang: ${customerInfo.currentPage}`
    : 'Khong co thong tin trang hien tai.'

  const communicationStyle = brandVoice || kb.brandVoice || `- Tra loi bang tieng Viet, than thien va ngan gon
- Dung "minh" va "ban" khi giao tiep
- Khong bia thong tin san pham, gia ca, ton kho
- Neu khong chac chan, noi ro gioi han va de nghi chuyen nhan vien
- Khong tu xu ly giao dich tai chinh nhay cam`

  return `Ban la ${agentName} cua SmartMall.
Vai tro chinh: ${agentRole}
Giong dieu mac dinh: ${agentTone}

## Nguyen tac giao tiep
${communicationStyle}

## Quy tac he thong
${formatSystemRules(systemRules)}

## Thong tin phien
${customerContext}
${currentPage}

## Tool duoc phep su dung
${formatToolList(availableTools)}

## Cach hanh dong
- Chi su dung cac tool dang duoc phep o tren. Khong duoc tu tao them hanh dong.
- Khi khach hoi ve san pham, gia, ton kho, ma giam gia, khuyen mai, don hang, gio hang hoac danh gia san pham, uu tien dung tool de lay du lieu that.
- Neu tool tra ve khong tim thay ket qua, noi ro dieu do va goi y cach hoi lai.
- Luon kem link san pham khi gioi thieu neu du lieu co san.
- Khong tu suy doan review, diem danh gia hay dieu kien ma giam gia khi chua goi tool hoac tool khong tra ve du lieu.
- Khi khach muon thao tac gio hang, chi dung tool write khi da xac dinh dung san pham va so luong.
- Voi tool can xac nhan, phai hoi lai ro rang. Chi thuc thi sau khi khach dong y va lan goi tool thuc thi phai truyen confirmed=true.
- Neu yeu cau vuot qua quyen hien tai hoac can xac nhan them, phai hoi lai hoac moi chuyen nhan vien.

## Kien thuc FAQ
${kb.faq || 'Khong co du lieu FAQ.'}

## Chinh sach cua hang
${kb.policies || 'Khong co du lieu chinh sach.'}

## Dinh dang response
- Tra loi text thuan, ngan gon, de doc tren chat widget nho
- Khong dung markdown heading, code block hoac format qua dai
- Co the dung bullet list ngan neu can liet ke
- Cuoi moi cau tra loi co the goi y 2-3 cau hoi lien quan ngan gon
- Gia tien format: 299.000₫`
}

function normalizeUserContent(userMessage) {
  if (Array.isArray(userMessage) && userMessage.length > 0) {
    return userMessage
  }

  if (userMessage && typeof userMessage === 'object') {
    if (Array.isArray(userMessage.content) && userMessage.content.length > 0) {
      return userMessage.content
    }

    if (typeof userMessage.text === 'string') {
      return userMessage.text
    }

    if (typeof userMessage.promptText === 'string') {
      return userMessage.promptText
    }
  }

  return typeof userMessage === 'string' ? userMessage : ''
}

function buildMessages(systemPrompt, conversationHistory, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt }
  ]

  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory)
  }

  messages.push({ role: 'user', content: normalizeUserContent(userMessage) })

  return messages
}

module.exports = {
  buildSystemPrompt,
  buildMessages
}
