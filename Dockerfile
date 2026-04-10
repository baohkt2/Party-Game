# syntax=docker/dockerfile:1.7

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Biến public cần lúc build (truyền vào qua --build-arg)
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER
ENV NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY
ENV NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public       ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next        ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]