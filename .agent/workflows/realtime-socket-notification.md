---
description: Tích hợp thông báo Real-time (Socket.IO) cho Admin và Khách hàng
---

# Workflow: Tích hợp Real-time Notifications với Socket.IO

Workflow này mô tả quá trình xây dựng hệ thống thông báo thời gian thực giữa Backend (Node.js/Express) và Frontend (React).

---

## 1. Cấu trúc Real-time

Hệ thống sử dụng **Rooms** để gửi thông báo đúng đối tượng:
-   **Room `admin`**: Dành cho tất cả các tài khoản admin. Nhận thông báo khi có đơn hàng mới (`new_order`).
-   **Room `user_{userId}`**: Dành riêng cho từng user. Nhận thông báo khi trạng thái đơn hàng của họ thay đổi (`order_status_updated`).

---

## 2. Phần Backend (Node.js)

### BƯỚC 1: Cài đặt và Singleton Helper
Tạo `api/v1/helpers/socket.js` để có thể `emit` sự kiện từ bất kỳ controller nào mà không cần truyền biến `io` rườm rà.

```javascript
let _io = null;
function initIO(io) { _io = io; }
function getIO() { return _io; }
module.exports = { initIO, getIO };
```

### BƯỚC 2: Khởi tạo Server tại `index.js`
Thay vì `app.listen`, ta dùng `http.createServer(app)` để gắn Socket.IO vào.

```javascript
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_URL } });

initIO(io); // Lưu vào singleton

io.on('connection', socket => {
  socket.on('join', ({ role, userId }) => {
    if (role === 'admin') socket.join('admin');
    if (userId) socket.join(`user_${userId}`);
  });
});
server.listen(port);
```

### BƯỚC 3: Emit sự kiện từ Controller
Tại `controllers/client/orders.controller.js` hoặc `payment.controller.js`:

```javascript
const { getIO } = require('../../helpers/socket');

// Khi đơn hàng được tạo/thanh toán thành công:
getIO().to('admin').emit('new_order', { _id, total, contact });
```

Tại `controllers/admin/orders.controller.js`:

```javascript
// Khi admin đổi trạng thái đơn hàng:
getIO().to(`user_${order.userId}`).emit('order_status_updated', { _id, status });
```

---

## 3. Phần Frontend (React)

### BƯỚC 4: Socket Service
Tạo `services/socketService.js` để quản lý kết nối duy nhất và tái sử dụng.

```javascript
import { io } from 'socket.io-client';
const s = io(process.env.REACT_APP_SOCKET_URL);
export const connectSocket = ({ role, userId }) => {
  s.connect();
  s.emit('join', { role, userId });
};
```

### BƯỚC 5: UI Admin (NotificationBell)
Tạo component hiển thị danh sách đơn hàng mới real-time. Khi click vào thông báo, chuyển hướng đến chi tiết đơn hàng.

### BƯỚC 6: Tích hợp vào Layout
-   **LayoutAdmin**: Gọi `connectSocket({ role: 'admin' })` khi mount.
-   **LayoutDefault**: Gọi `connectSocket({ role: 'user', userId })` nếu user đã đăng nhập. Sử dụng `antd.notification` để hiện toast khi có sự kiện `order_status_updated`.

---

## 4. Lưu ý quan trọng khi triển khai

1.  **CORS**: Socket.IO yêu cầu cấu hình CORS riêng biệt trong config server.
2.  **IPv6 vs IPv4**: Khi test ở localhost, client thường gửi IP là `::1`. Nếu database hoặc cổng thanh toán yêu cầu IPv4, cần convert về `127.0.0.1`.
3.  **Cleanup**: Luôn `socket.off('event')` hoặc `disconnect()` khi component unmount để tránh rò rỉ bộ nhớ hoặc duplicate thông báo.
4.  **Redux Store**: Cần đảm bảo `userId` được lấy chính xác từ Redux store để join đúng room cá nhân.
