# SmartMall API

Backend API for SmartMall e-commerce: public storefront APIs, admin dashboard APIs, auth, orders, payments, CMS, chatbot, Socket.IO, Redis cache, MongoDB persistence, and Swagger docs.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- Redis + ioredis
- Socket.IO
- JWT auth + refresh tokens
- Passport OAuth: Google, Facebook, GitHub
- Swagger/OpenAPI
- Cloudinary uploads
- Nodemailer email
- VNPay, MoMo, ZaloPay, Sepay payment/webhook flows
- Winston logs

## Requirements

- Node.js 18+
- npm
- MongoDB
- Redis

## Install

```bash
npm install
```

## Environment

Create `.env` in this directory.

Required for local boot:

```env
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:3001
MONGO_URL=mongodb://localhost:27017/smartmall
REDIS_URL=redis://localhost:6379
ACCESS_SECRET=change_me
REFRESH_SECRET=change_me
JWT_EXPIRES_IN_ACCESS=1h
JWT_EXPIRES_IN_REFRESH=30d
```

Uploads:

```env
CLOUD_NAME=
API_KEY=
API_SECRET=
```

Email:

```env
MAIL_USER=
MAIL_PASS=
```

OAuth:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/user/google/callback
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:3001/api/v1/user/facebook/callback
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3001/api/v1/user/github/callback
```

AI/chatbot:

```env
CHATBOT_ENABLED=true
CHATBOT_PROVIDER=openai
CHATBOT_MODEL=
CHATBOT_MAX_TOKENS=1000
CHATBOT_TEMPERATURE=0.7
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
GROQ_API_KEY=
NINEROUTER_API_KEY=
NINEROUTER_BASE_URL=
```

Payments:

```env
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_ENDPOINT=
MOMO_REDIRECT_URL=http://localhost:3000/order-success
MOMO_IPN_URL=http://localhost:3001/api/v1/payment/momo/callback

VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_URL=
VNPAY_RETURN_URL=http://localhost:3001/api/v1/payment/vnpay/return

ZALOPAY_APP_ID=
ZALOPAY_KEY1=
ZALOPAY_KEY2=
ZALOPAY_ENDPOINT=
ZALOPAY_CALLBACK_URL=http://localhost:3001/api/v1/payment/zalopay/callback
ZALOPAY_REDIRECT_URL=http://localhost:3000/order-success

SEPAY_WEBHOOK_API_KEY=
SEPAY_BANK_ACCOUNT=
```

Other optional values:

```env
LOG_LEVEL=info
DIGITAL_CREDENTIAL_SECRET=
BLOG_AUTO_PUBLISH_ENABLED=true
BLOG_AUTO_DRAFT_ENABLED=false
BLOG_PUBLISH_CHECK_SCHEDULE=*/15 * * * *
BLOG_GENERATION_SCHEDULE=0 9 * * 1,3,5
BLOG_MAX_POSTS_PER_DAY=2
BLOG_AGENT_PROVIDER=9router
BLOG_AGENT_MODEL=cx/gpt-5.4
```

Do not commit `.env`.

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Default URLs:

- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api-docs`
- Docs redirect: `http://localhost:3001/docs`
- Health: `http://localhost:3001/health`

## Scripts

- `npm run dev` - run with nodemon and inspector
- `npm start` - run `index.js`
- `npm run seed:chat` - seed chat conversations
- `npm run migrate:content-pages` - migrate CMS content pages
- `npm test` - placeholder, no test suite configured

## Docker

Local development with API + Redis:

```bash
docker compose up --build
```

Production compose:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Production compose expects `/opt/sales-api/.env` on the host and persists logs to `/opt/sales-api/logs`.

## Auth

- Client auth base: `/api/v1/user`
- Admin auth base: `/api/v1/admin/auth`
- Protected APIs use `Authorization: Bearer <token>`
- Refresh tokens are handled through refresh-token endpoints and persisted in DB
- CORS uses `CLIENT_URL` and `credentials: true`

## API groups

Public/client base: `/api/v1`

- `/products`
- `/product-categories`
- `/user`
- `/cart`
- `/promo-codes`
- `/orders`
- `/order-tracking`
- `/widgets`
- `/banners`
- `/about`
- `/contact`
- `/faq`
- `/return-policy`
- `/privacy-policy`
- `/terms`
- `/vip`
- `/blog`
- `/blog-categories`
- `/blog-tags`
- `/flash-sales`
- `/reviews`
- `/payment`
- `/webhook`
- `/chat`

Admin base: `/api/v1/admin`

- `/dashboard`
- `/products`
- `/product-content-assistant`
- `/product-credentials`
- `/product-categories`
- `/permissions`
- `/permission-groups`
- `/roles`
- `/accounts`
- `/auth`
- `/me`
- `/orders`
- `/flash-sales`
- `/promo-codes`
- `/reviews`
- `/purchase-receipts`
- `/banners`
- `/widgets`
- `/website-config`
- `/bank-info`
- `/media-library`
- `/blog`
- `/blog-categories`
- `/blog-tags`
- `/blog-agent`
- `/chatbot-config`
- `/quick-replies`
- `/quick-reply-categories`
- CMS content routes for about, contact, FAQ, footer, policies, terms, VIP, coming soon, game content, and content pages

Use Swagger for request/response details.

## Realtime

Socket.IO is initialized on the same HTTP server. The frontend should connect to:

```env
VITE_SOCKET_URL=http://localhost:3001
```

Primary realtime use cases:

- client support chat
- admin chat handling
- conversation assignment/status/read events

## Jobs

Started automatically from `index.js`:

- recommendation score recalculation
- expired order reservation release
- blog auto publish/draft jobs

Blog job behavior is controlled by `BLOG_*` env vars.

## Project layout

```text
sales-api/
  api/v1/
    controllers/
    docs/
    factories/
    helpers/
    jobs/
    middlewares/
    models/
    repositories/
    routes/
    services/
    socket/
    utils/
    validations/
  config/
  logs/
  index.js
  Dockerfile
  docker-compose.yml
  docker-compose.prod.yml
```

## Logging

Logs use Winston and rotate under `logs/`. Set `LOG_LEVEL` to control verbosity.

## Swagger

Swagger config lives in `config/swagger.js`; docs are loaded from `api/v1/docs/*.yaml`.

Open:

```text
http://localhost:3001/api-docs
```

## Notes

- `MONGO_URL` is required; the API throws on Mongo connection failure.
- `REDIS_URL` is optional but recommended. `rediss://` enables TLS.
- Docker local compose overrides Redis to `redis://redis:6379`.
- Payment gateway defaults are sandbox/dev-oriented; set real secrets in production.
- File uploads require Cloudinary env values.
