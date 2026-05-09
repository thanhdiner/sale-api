/**
 * Lấy IP address của client từ request.
 * Luôn trả về IPv4 (VNPay và một số cổng không chấp nhận IPv6).
 * @param {import('express').Request} req
 * @returns {string} IPv4 address
 */
function getClientIp(req) {
  const raw =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'

  // Chuyển IPv6 loopback → IPv4
  if (raw === '::1' || raw === '::ffff:127.0.0.1') return '127.0.0.1'
  // Strip IPv6-mapped IPv4 prefix (::ffff:x.x.x.x)
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

module.exports = { getClientIp }









