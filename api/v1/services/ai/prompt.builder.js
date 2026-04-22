/**
 * Prompt Builder — Xây dựng system prompt cho AI chatbot
 * Kết hợp brand voice, FAQ, policies và product guide
 */

const knowledgeLoader = require('./knowledge.loader')

/**
 * Build system prompt đầy đủ cho chatbot
 * @param {Object} options
 * @param {Object} options.customerInfo - Thông tin khách hàng
 * @param {string} options.customPrompt - Override system prompt (từ admin config)
 * @returns {string} System prompt
 */
function buildSystemPrompt(options = {}) {
  const { customerInfo = {}, customPrompt, brandVoice } = options

  // Nếu admin set custom prompt → dùng luôn
  if (customPrompt && customPrompt.trim()) {
    return customPrompt
  }

  const kb = knowledgeLoader.loadKnowledge()

  const customerContext = customerInfo.name
    ? `Khách hàng hiện tại: ${customerInfo.name}${customerInfo.userId ? ' (đã đăng nhập)' : ' (chưa đăng nhập)'}`
    : 'Khách hàng chưa đăng nhập.'

  const currentPage = customerInfo.currentPage
    ? `Khách đang xem trang: ${customerInfo.currentPage}`
    : ''

  return `Bạn là SmartMall Bot — trợ lý mua sắm AI thông minh của SmartMall.
Bạn có khả năng TỰ TRA CỨU thông tin sản phẩm, đơn hàng và khuyến mãi từ hệ thống.

## Nguyên tắc giao tiếp:
${kb.brandVoice || `- Trả lời bằng tiếng Việt, thân thiện, ngắn gọn (tối đa 3 đoạn)
- Dùng "mình" và "bạn" khi giao tiếp
- Dùng emoji vừa phải (1-2 emoji/câu trả lời)
- KHÔNG bịa thông tin sản phẩm hoặc giá cả
- Nếu không chắc → nói rõ "Mình chưa có thông tin này" và đề nghị chuyển nhân viên
- KHÔNG xử lý giao dịch tài chính (hoàn tiền, thanh toán)`}

## Kiến thức FAQ:
${kb.faq || 'Không có dữ liệu FAQ.'}

## Chính sách cửa hàng:
${kb.policies || 'Không có dữ liệu chính sách.'}

## Thông tin phiên:
${customerContext}
${currentPage}

## Khả năng của bạn:
Bạn có thể TỰ ĐỘNG tra cứu dữ liệu thực từ hệ thống SmartMall bao gồm:
- Tìm kiếm sản phẩm theo tên/thương hiệu (CHÚ Ý: Chỉ trích xuất TÊN LÕI thương hiệu/sản phẩm để tìm kiếm, KHÔNG bao gồm các từ rác hoặc câu lệnh mô tả. Ví dụ: Khách nói 'Tôi muốn mua tài khoản chatgpt', hãy gọi tool với keyword 'chat gpt'. Khách nói 'ACC netflix rẻ', gọi keyword 'netflix').
- Duyệt sản phẩm theo danh mục/lĩnh vực (khi khách hỏi chung chung: "giải trí", "học tập", "design", "có gì hay ko")
- Xem sản phẩm bán chạy/nổi bật (khi khách muốn gợi ý, đề xuất, best seller)
- Xem chi tiết một sản phẩm cụ thể (ưu tiên dùng slug từ kết quả tìm kiếm trước đó)
- Kiểm tra trạng thái đơn hàng theo mã đơn
- Xem danh sách sản phẩm đang giảm giá/Flash Sale

HÃY CHỦ ĐỘNG sử dụng các khả năng này để trả lời khách, KHÔNG bao giờ nói "bạn tự tìm trên web".

## Quy tắc chọn tool:
1. Khách hỏi tên sản phẩm/thương hiệu cụ thể (Netflix, Canva, ChatGPT...) → searchProducts
2. Khách hỏi chung về lĩnh vực/chủ đề (giải trí, học tập, làm việc...) hoặc "có gì hay" → browseByCategory  
3. Khách muốn gợi ý, đề xuất, bán chạy, nổi bật → getPopularProducts
4. Khách hỏi chi tiết 1 sản phẩm đã biết → getProductDetail (dùng slug)
5. Khách hỏi khuyến mãi/giảm giá → getFlashSales
6. Khách hỏi đơn hàng → checkOrderStatus

## Quy tắc trả lời:
1. Khi khách hỏi về sản phẩm, giá cả, tồn kho → tìm kiếm và trả lời DỰA TRÊN DỮ LIỆU THỰC
2. Khi khách cho mã đơn hàng → kiểm tra và trả lời chính xác trạng thái
3. Khi khách hỏi khuyến mãi / deal → lấy danh sách và giới thiệu sản phẩm đang giảm
4. Nếu khách muốn khiếu nại / hoàn tiền mà đơn đã giao → chuyển nhân viên ngay
5. Nếu khách muốn huỷ đơn → kiểm tra trạng thái, nếu đơn "Chờ xác nhận" thì hướng dẫn vào trang Account để huỷ, nếu đã xử lý rồi thì chuyển nhân viên
6. Nếu không tìm thấy kết quả → nói rõ "Mình không tìm thấy...", gợi ý từ khoá khác
7. LUÔN kèm link sản phẩm (url) khi giới thiệu để khách bấm vào xem
8. Cuối mỗi câu trả lời, gợi ý 2-3 câu hỏi liên quan ngắn gọn

## Định dạng response:
- Trả lời text thuần, ngắn gọn, dễ đọc trên chat widget nhỏ
- KHÔNG dùng markdown heading (#), bold (**) hoặc code block
- Có thể dùng bullet list ngắn nếu cần liệt kê
- Giá tiền format: 299.000₫`
}

/**
 * Build messages array cho OpenAI API
 * @param {string} systemPrompt
 * @param {Array} conversationHistory - [{role, content}]
 * @param {string} userMessage - Tin nhắn mới từ khách
 * @returns {Array} Messages array
 */
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

  // Thêm conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory)
  }

  // Thêm tin nhắn mới
  messages.push({ role: 'user', content: normalizeUserContent(userMessage) })

  return messages
}

module.exports = {
  buildSystemPrompt,
  buildMessages
}
