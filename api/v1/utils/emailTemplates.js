exports.getVerifyCodeHtml = (title, code) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:400px;margin:auto;background:#f9fafb;border-radius:8px;padding:24px;border:1px solid #eee;">
    <h2 style="color:#2563eb;margin-bottom:16px;">${title}</h2>
    <p style="margin:0 0 8px;">Xin chào,</p>
    <p style="margin:0 0 8px;">Bạn vừa yêu cầu xác thực. Nhập mã bên dưới:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#2563eb;padding:16px 0;">${code}</div>
    <p style="margin:24px 0 0 0;color:#888;font-size:13px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
  </div>
`
