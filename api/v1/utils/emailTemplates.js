exports.getVerifyCodeHtml = (title, code) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:400px;margin:auto;background:#f9fafb;border-radius:8px;padding:24px;border:1px solid #eee;">
    <h2 style="color:#2563eb;margin-bottom:16px;">${title}</h2>
    <p style="margin:0 0 8px;">Xin chào,</p>
    <p style="margin:0 0 8px;">Bạn vừa yêu cầu xác thực. Nhập mã bên dưới:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#2563eb;padding:16px 0;">${code}</div>
    <p style="margin:24px 0 0 0;color:#888;font-size:13px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
  </div>
`

// ─── Shared helpers ───────────────────────────────────────────────────────────

const formatCurrency = n =>
  Number(n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })

const paymentMethodLabel = method => {
  const map = {
    transfer: '💳 Chuyển khoản ngân hàng',
    contact: '💵 Thanh toán khi nhận hàng (COD)',
    vnpay: '🏦 VNPay',
    momo: '💜 MoMo',
    zalopay: '🔵 ZaloPay',
    sepay: 'Sepay'
  }
  return map[method] || method
}

const statusLabel = status => {
  const map = {
    pending: '⏳ Chờ xác nhận',
    confirmed: '✅ Đã xác nhận',
    shipping: '🚚 Đang giao hàng',
    completed: '🎉 Hoàn thành',
    cancelled: '❌ Đã hủy'
  }
  return map[status] || status
}

const statusColor = status => {
  const map = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    shipping: '#8b5cf6',
    completed: '#10b981',
    cancelled: '#ef4444'
  }
  return map[status] || '#6b7280'
}

const renderItems = items =>
  items
    .map(
      i => `
  <tr>
    <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${i.image ? `<img src="${i.image}" alt="${i.name}" width="56" height="56" style="border-radius:8px;object-fit:cover;" />` : ''}
        <span style="font-weight:600;color:#1f2937;">${i.name}</span>
      </div>
    </td>
    <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;">x${i.quantity}</td>
    <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:right;color:#1f2937;font-weight:600;">${formatCurrency(i.price * i.quantity)}</td>
  </tr>`
    )
    .join('')

const baseLayout = content => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>SmartMall</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">🛒 SmartMall</h1>
            <p style="margin:8px 0 0;color:#c4b5fd;font-size:14px;">Mua sắm thông minh, cuộc sống tiện lợi</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:24px;text-align:center;color:#94a3b8;font-size:12px;">
            <p style="margin:0;">© ${new Date().getFullYear()} SmartMall. Cảm ơn bạn đã tin tưởng mua sắm cùng chúng tôi.</p>
            <p style="margin:6px 0 0;">Email này được gửi tự động, vui lòng không trả lời.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const orderSummaryBlock = order => `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <thead>
    <tr style="background:#f8fafc;">
      <th style="padding:12px 10px;text-align:left;color:#6b7280;font-size:13px;font-weight:600;">Sản phẩm</th>
      <th style="padding:12px 10px;text-align:center;color:#6b7280;font-size:13px;font-weight:600;">SL</th>
      <th style="padding:12px 10px;text-align:right;color:#6b7280;font-size:13px;font-weight:600;">Thành tiền</th>
    </tr>
  </thead>
  <tbody>${renderItems(order.orderItems)}</tbody>
  <tfoot>
    <tr>
      <td colspan="2" style="padding:8px 10px;text-align:right;color:#6b7280;font-size:13px;">Tạm tính:</td>
      <td style="padding:8px 10px;text-align:right;color:#1f2937;">${formatCurrency(order.subtotal)}</td>
    </tr>
    ${order.discount > 0 ? `
    <tr>
      <td colspan="2" style="padding:8px 10px;text-align:right;color:#6b7280;font-size:13px;">Giảm giá:</td>
      <td style="padding:8px 10px;text-align:right;color:#10b981;">- ${formatCurrency(order.discount)}</td>
    </tr>` : ''}
    <tr>
      <td colspan="2" style="padding:8px 10px;text-align:right;color:#6b7280;font-size:13px;">Phí giao hàng:</td>
      <td style="padding:8px 10px;text-align:right;color:#1f2937;">${order.shipping > 0 ? formatCurrency(order.shipping) : 'Miễn phí'}</td>
    </tr>
    <tr style="background:#f8fafc;">
      <td colspan="2" style="padding:12px 10px;text-align:right;font-weight:700;color:#1f2937;">Tổng cộng:</td>
      <td style="padding:12px 10px;text-align:right;font-weight:800;color:#6366f1;font-size:18px;">${formatCurrency(order.total)}</td>
    </tr>
  </tfoot>
</table>`

// ─── T1: Đặt hàng thành công (COD / Transfer) ────────────────────────────────

exports.orderConfirmedTemplate = order => {
  const fullName = `${order.contact.firstName} ${order.contact.lastName}`
  const orderId = order._id.toString()

  const content = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;font-weight:800;">Đặt hàng thành công! 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;">Xin chào <strong>${fullName}</strong>, cảm ơn bạn đã đặt hàng tại SmartMall.</p>
    <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Mã đơn hàng:</td>
          <td style="text-align:right;font-weight:700;color:#6366f1;font-size:13px;">#${orderId.slice(-8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Ngày đặt:</td>
          <td style="text-align:right;color:#1f2937;font-size:13px;">${new Date(order.createdAt).toLocaleString('vi-VN')}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Phương thức thanh toán:</td>
          <td style="text-align:right;color:#1f2937;font-size:13px;">${paymentMethodLabel(order.paymentMethod)}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Trạng thái:</td>
          <td style="text-align:right;">
            <span style="background:${statusColor(order.status)};color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">
              ${statusLabel(order.status)}
            </span>
          </td>
        </tr>
      </table>
    </div>
    ${orderSummaryBlock(order)}
    <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-weight:700;color:#065f46;font-size:13px;">📦 Thông tin liên hệ</p>
      <p style="margin:0;color:#1f2937;font-size:14px;">${fullName} — ${order.contact.phone}</p>
      ${order.contact.notes ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Ghi chú: ${order.contact.notes}</p>` : ''}
    </div>
    <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">Chúng tôi sẽ liên hệ với bạn để xác nhận đơn hàng sớm nhất. Cảm ơn bạn đã tin tưởng SmartMall! 💜</p>`

  return {
    subject: `✅ SmartMall — Xác nhận đơn hàng #${orderId.slice(-8).toUpperCase()}`,
    html: baseLayout(content)
  }
}

// ─── T2: Thanh toán online thành công ────────────────────────────────────────

exports.paymentSuccessTemplate = order => {
  const fullName = `${order.contact.firstName} ${order.contact.lastName}`
  const orderId = order._id.toString()

  const content = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;font-weight:800;">Thanh toán thành công! 💳</h2>
    <p style="margin:0 0 24px;color:#6b7280;">Xin chào <strong>${fullName}</strong>, khoản thanh toán của bạn đã được xác nhận.</p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:36px;">✅</p>
      <p style="margin:8px 0 0;font-weight:700;color:#065f46;font-size:16px;">Thanh toán thành công</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Phương thức: ${paymentMethodLabel(order.paymentMethod)}</p>
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Mã đơn hàng:</td>
          <td style="text-align:right;font-weight:700;color:#6366f1;font-size:13px;">#${orderId.slice(-8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Số tiền:</td>
          <td style="text-align:right;font-weight:800;color:#10b981;font-size:15px;">${formatCurrency(order.total)}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Thời gian:</td>
          <td style="text-align:right;color:#1f2937;font-size:13px;">${new Date().toLocaleString('vi-VN')}</td>
        </tr>
        ${order.paymentTransactionId ? `
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Mã giao dịch:</td>
          <td style="text-align:right;color:#1f2937;font-size:12px;font-family:monospace;">${order.paymentTransactionId}</td>
        </tr>` : ''}
      </table>
    </div>
    ${orderSummaryBlock(order)}
    <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">Đơn hàng đang được xử lý. Chúng tôi sẽ thông báo khi hàng được giao. 🚀</p>`

  return {
    subject: `💳 SmartMall — Thanh toán thành công #${orderId.slice(-8).toUpperCase()}`,
    html: baseLayout(content)
  }
}

// ─── T3: Admin cập nhật trạng thái đơn ───────────────────────────────────────

exports.orderStatusUpdatedTemplate = order => {
  const fullName = `${order.contact.firstName} ${order.contact.lastName}`
  const orderId = order._id.toString()
  const color = statusColor(order.status)
  const icon = { confirmed: '✅', shipping: '🚚', completed: '🎉', cancelled: '❌' }[order.status] || '📦'
  const statusMessages = {
    confirmed: 'Đơn hàng của bạn đã được xác nhận và đang được chuẩn bị. 📦',
    shipping: 'Đơn hàng đang trên đường giao đến bạn. Vui lòng chú ý điện thoại! 🚚',
    completed: 'Đơn hàng đã giao thành công! Cảm ơn bạn đã mua sắm tại SmartMall. 🎉',
    cancelled: 'Đơn hàng của bạn đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ với chúng tôi.'
  }

  const content = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;font-weight:800;">Cập nhật đơn hàng</h2>
    <p style="margin:0 0 24px;color:#6b7280;">Xin chào <strong>${fullName}</strong>, trạng thái đơn hàng của bạn vừa được cập nhật.</p>
    <div style="background:${color}18;border:2px solid ${color};border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:32px;">${icon}</p>
      <p style="margin:10px 0 4px;font-weight:800;font-size:18px;color:${color};">${statusLabel(order.status)}</p>
      <p style="margin:0;color:#6b7280;font-size:14px;">${statusMessages[order.status] || ''}</p>
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Mã đơn hàng:</td>
          <td style="text-align:right;font-weight:700;color:#6366f1;font-size:13px;">#${orderId.slice(-8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Tổng giá trị:</td>
          <td style="text-align:right;font-weight:700;color:#1f2937;">${formatCurrency(order.total)}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:4px 0;">Thời gian cập nhật:</td>
          <td style="text-align:right;color:#1f2937;font-size:13px;">${new Date().toLocaleString('vi-VN')}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">Nếu có bất kỳ thắc mắc nào, đừng ngần ngại liên hệ với chúng tôi. 💜</p>`

  return {
    subject: `📦 SmartMall — Đơn hàng #${orderId.slice(-8).toUpperCase()} — ${statusLabel(order.status)}`,
    html: baseLayout(content)
  }
}
