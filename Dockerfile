# 读伴 · Docker 多阶段构建(Next 16 standalone 模式)
# 用法:
#   docker build -t duban .
#   docker run -p 3000:3000 \
#     -e DATABASE_URL=file:/app/data/dev.db \
#     -e AI_API_KEY=sk-xxx -e AUTH_SECRET=xxx \
#     -v duban_data:/app/data \
#     duban

# ---------- 1. deps ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- 2. builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---------- 3. runner ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 非 root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 duban

COPY --from=builder /app/public ./public
COPY --from=builder --chown=duban:nodejs /app/.next/standalone ./
COPY --from=builder --chown=duban:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=duban:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# standalone 不包含 prisma CLI,但 runtime 需要执行 prisma db push —— 拷一份
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript

# 持久化目录
RUN mkdir -p /app/data && chown -R duban:nodejs /app/data

USER duban
EXPOSE 3000

# 启动:首次运行时根据 schema 同步 DB,再启服务
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss && node server.js"]
