/**
 * Socket.IO singleton — dùng để emit events từ bất kỳ controller nào
 * mà không cần truyền `io` qua props.
 *
 * Cách dùng trong controller:
 *   const { getIO } = require('../../helpers/socket')
 *   getIO().to('admin').emit('new_order', { order })
 */

let _io = null

/**
 * Khởi tạo Socket.IO (gọi 1 lần duy nhất từ index.js)
 * @param {import('socket.io').Server} io
 */
function initIO(io) {
  _io = io
}

/**
 * Lấy instance Socket.IO đã khởi tạo
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!_io) throw new Error('Socket.IO chưa được khởi tạo — gọi initIO(io) trước')
  return _io
}

module.exports = { initIO, getIO }
