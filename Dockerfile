FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system app && adduser --system --ingroup app app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/core ./core
COPY --from=builder /app/server ./server
COPY --from=builder /app/mcp ./mcp

RUN chown -R app:app /app
USER app

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server/index.js"]

FROM node:22-slim AS full
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system app && adduser --system --ingroup app app

RUN apt-get update && apt-get install -y --no-install-recommends \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npx playwright install chromium --only-shell 2>/dev/null || true
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/core ./core
COPY --from=builder /app/server ./server
COPY --from=builder /app/mcp ./mcp

RUN chown -R app:app /app
USER app

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server/index.js"]
