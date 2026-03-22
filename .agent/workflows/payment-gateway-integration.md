---
description: Tích hợp cổng thanh toán VNPay, MoMo, ZaloPay vào ứng dụng Node.js + React
---

# Workflow: Tích hợp cổng thanh toán VNPay / MoMo / ZaloPay

## Tổng quan flow

```
User checkout → Chọn cổng → Tạo pending order → Redirect sang cổng
  → Cổng thanh toán xử lý → Redirect về app → Cập nhật trạng thái → Xóa cart
```

---

## BƯỚC 1 — Đăng ký tài khoản Sandbox

### VNPay
1. Đăng ký tại https://sandbox.vnpayment.vn/devreg/
2. Email: nhận **TMN Code** + **Hash Secret** qua mail
3. URL Sandbox: `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`
4. Điền vào `.env`:
   ```
   VNPAY_TMN_CODE=<tmnCode>
   VNPAY_HASH_SECRET=<hashSecret>
   VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
   VNPAY_RETURN_URL=http://localhost:3001/api/v1/payment/vnpay/return
   ```

### MoMo
1. Đăng ký tại https://developers.momo.vn
2. Lấy **Partner Code**, **Access Key**, **Secret Key**
3. Sandbox endpoint: `https://test-payment.momo.vn/v2/gateway/api/create`
4. Điền vào `.env`:
   ```
   MOMO_PARTNER_CODE=MOMO
   MOMO_ACCESS_KEY=F8BBA842ECF85
   MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
   MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
   MOMO_REDIRECT_URL=http://localhost:3000/order-success
   MOMO_IPN_URL=http://your-ngrok-url/api/v1/payment/momo/callback
   ```

### ZaloPay
1. Đăng ký tại https://docs.zalopay.vn
2. Lấy **App ID**, **Key1**, **Key2**
3. Sandbox endpoint: `https://sb-openapi.zalopay.vn/v2/create`
4. Điền vào `.env`:
   ```
   ZALOPAY_APP_ID=2553
   ZALOPAY_KEY1=PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL
   ZALOPAY_KEY2=kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz
   ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/create
   ZALOPAY_CALLBACK_URL=http://your-ngrok-url/api/v1/payment/zalopay/callback
   ZALOPAY_REDIRECT_URL=http://localhost:3000/order-success
   ```

---

## BƯỚC 2 — Tạo Payment Service (Backend)

### VNPay Service — `services/payment/vnpay.service.js`
**Nguyên tắc quan trọng:**
- Mỗi giá trị PHẢI được `encodeURIComponent(v).replace(/%20/g, '+')` trước khi ký
- Sort params theo alphabetical order
- Dùng `HMAC-SHA512` với secret key
- Dùng `qs.stringify(sortedParams, { encode: false })` vì values đã tự encode
- **Không dùng** `querystring.stringify(obj, { encode: false })` — tham số 2 là separator string, không phải options!

```js
const qs = require('qs')
const crypto = require('crypto')

function sortObject(obj) {
  const sorted = {}
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = encodeURIComponent(String(obj[key])).replace(/%20/g, '+')
  })
  return sorted
}

function createPaymentUrl({ orderId, amount, orderInfo, clientIp }) {
  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Amount: Math.round(amount) * 100,
    vnp_OrderInfo: orderInfo || `DH_${orderId}`,
    vnp_TxnRef: orderId,
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
    vnp_IpAddr: clientIp,    // Lưu ý: IPv6 ::1 phải đổi thành 127.0.0.1
    vnp_CreateDate: createDate,
    // ... các field khác
  }

  const sorted = sortObject(vnpParams)
  const signData = qs.stringify(sorted, { encode: false })
  const secureHash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex')

  sorted.vnp_SecureHash = secureHash
  return `${process.env.VNPAY_URL}?${qs.stringify(sorted, { encode: false })}`
}
```

### MoMo Service — `services/payment/momo.service.js`
- Ký bằng `HMAC-SHA256`
- Gọi MoMo API (POST), nhận về `payUrl` từ response
- `extraData` encode base64 chứa `orderId` thật để recover sau callback

```js
// Raw signature format:
const rawSignature =
  `accessKey=${MOMO_ACCESS_KEY}` +
  `&amount=${amount}` +
  `&extraData=${extraData}` +
  `&ipnUrl=${ipnUrl}` +
  `&orderId=${requestId}` +
  `&orderInfo=${orderInfo}` +
  `&partnerCode=${partnerCode}` +
  `&redirectUrl=${redirectUrl}` +
  `&requestId=${requestId}` +
  `&requestType=payWithMethod`
```

### ZaloPay Service — `services/payment/zalopay.service.js`
- Ký bằng `HMAC-SHA256` với **key1**
- Callback verify dùng **key2** (khác key!)

```js
// Raw signature:
const rawSignature = [appId, appTransId, appUser, amount, appTime, embedData, items].join('|')
const mac = crypto.createHmac('sha256', key1).update(rawSignature).digest('hex')

// Verify callback dùng key2:
const verify = crypto.createHmac('sha256', key2).update(data).digest('hex')
```

---

## BƯỚC 3 — Xử lý IP Address

```js
function getClientIp(req) {
  const raw = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || '127.0.0.1'
  // VNPay chỉ chấp nhận IPv4 — convert ::1 sang 127.0.0.1
  if (raw === '::1' || raw === '::ffff:127.0.0.1') return '127.0.0.1'
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}
```

---

## BƯỚC 4 — Routes Backend

```
POST /api/v1/orders/pending        → tạo đơn (status=pending, paymentStatus=pending)

POST /api/v1/payment/vnpay/create  → (auth) tạo VNPay URL
GET  /api/v1/payment/vnpay/return  → (public) VNPay redirect sau thanh toán

POST /api/v1/payment/momo/create   → (auth) tạo MoMo URL
POST /api/v1/payment/momo/callback → (public) IPN webhook từ MoMo

POST /api/v1/payment/zalopay/create   → (auth) tạo ZaloPay URL
POST /api/v1/payment/zalopay/callback → (public) IPN webhook từ ZaloPay
```

---

## BƯỚC 5 — Frontend Flow

```js
// ReviewOrder.jsx
if (['vnpay', 'momo', 'zalopay'].includes(paymentMethod)) {
  // 1. Tạo pending order
  const { orderId } = await createPendingOrder(orderPayload)
  // 2. Lấy payment URL + redirect
  await redirectToPayment(paymentMethod, orderId)
  // (trình duyệt chuyển trang — code bên dưới không chạy)
}
```

---

## BƯỚC 6 — Xử lý redirect về

```js
// OrderSuccessPage.jsx — đọc query params từ cổng redirect về
const vnpResponseCode = search.get('vnp_ResponseCode')   // VNPay
const momoResultCode  = search.get('resultCode')          // MoMo
const method          = search.get('method')              // ZaloPay (qua backend redirect)

// VNPay thành công: vnp_ResponseCode === '00'
// MoMo thành công:  resultCode === '0'
// ZaloPay thành công: backend redirect về với method=zalopay (không có failed)
```

---

## BƯỚC 7 — Xóa giỏ hàng sau khi thanh toán thành công

```js
// Trong OrderSuccessPage, sau khi xác định thành công:
const res = await getOrderDetail(orderId)
const productIds = res.order.orderItems.map(i => i.productId)
await removeManyCartItems({ productIds })
const newCart = await getCart()
dispatch(setCart(newCart.items.map(item => ({ ...item, id: item.productId }))))
```

---

## Thẻ test

### VNPay
| | |
|---|---|
| Ngân hàng | NCB |
| Số thẻ | `9704198526191432198` |
| Tên chủ thẻ | `NGUYEN VAN A` |
| Ngày PH | `07/15` |
| OTP | `123456` |

### MoMo / ZaloPay
Dùng tài khoản sandbox đăng ký trên portal developer tương ứng.

---

## Lưu ý quan trọng

> **IPN URL (Webhook)** của MoMo và ZaloPay cần là URL public (HTTPS).
> Khi dev local, dùng **ngrok**: `ngrok http 3001`
> Rồi điền URL ngrok vào `MOMO_IPN_URL` và `ZALOPAY_CALLBACK_URL`.
> VNPay dùng **Return URL** (redirect trực tiếp) nên localhost vẫn hoạt động khi test.

> **Production**: Đổi tất cả sandbox URL, credentials, và webhook URL sang domain thật trước khi deploy.
