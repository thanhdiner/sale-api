# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install ALL dependencies (including devDeps like nodemon for build steps)
RUN npm ci --frozen-lockfile

# Copy source code
COPY . .

# ─── Stage 2: Runner (production) ─────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production node_modules from builder
COPY package*.json ./
RUN npm ci --frozen-lockfile --omit=dev

# Copy source from builder (not node_modules)
COPY --from=builder /app/api ./api
COPY --from=builder /app/config ./config
COPY --from=builder /app/index.js ./index.js

# Create logs directory with correct ownership
RUN mkdir -p logs && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port (matches PORT env var, default 3001)
EXPOSE 3001

# Healthcheck: verify the API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Start the app (production mode, no nodemon)
CMD ["node", "index.js"]
