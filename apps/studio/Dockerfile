# FarmacoGraph Curation Studio — production image
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at build time.
# Pass via docker-compose build.args (FG_STUDIO_API_URL / FG_STUDIO_BASE_PATH).
# Runtime -e alone will NOT fix a wrong baked API URL or basePath in JS chunks.
ARG NEXT_PUBLIC_API_URL=https://farmacograph.furkanguven.space/api/v1
ARG NEXT_PUBLIC_BASE_PATH=/studio
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN echo "Building Studio with NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}" \
  && node -e " \
    const api = (process.env.NEXT_PUBLIC_API_URL || '').trim(); \
    const base = process.env.NEXT_PUBLIC_BASE_PATH || ''; \
    const unsafe = /^(https?:\\/\\/)?(127\\.0\\.0\\.1|localhost|0\\.0\\.0\\.0|\\[::1\\]|host\\.docker\\.internal)([:/]|$)/i; \
    if (!api) { console.error('NEXT_PUBLIC_API_URL is empty'); process.exit(1); } \
    if (unsafe.test(api)) { \
      console.error('Refusing to bake loopback/private NEXT_PUBLIC_API_URL into Studio image:', api); \
      console.error('Set FG_STUDIO_API_URL to the public https API origin (e.g. https://host/api/v1).'); \
      process.exit(1); \
    } \
    if (!/^https?:\\/\\//i.test(api)) { \
      console.error('NEXT_PUBLIC_API_URL must be an absolute http(s) URL:', api); \
      process.exit(1); \
    } \
    if (!base) { \
      console.error('NEXT_PUBLIC_BASE_PATH must be set for production Studio (expected /studio)'); \
      process.exit(1); \
    } \
    console.log('Pre-build env OK'); \
  " \
  && npm run build \
  && node -e " \
    const fs = require('fs'); \
    const expected = process.env.NEXT_PUBLIC_BASE_PATH || ''; \
    const manifest = JSON.parse(fs.readFileSync('.next/routes-manifest.json', 'utf8')); \
    const actual = manifest.basePath || ''; \
    if (actual !== expected) { \
      console.error('Studio build basePath mismatch: expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); \
      process.exit(1); \
    } \
    console.log('Verified routes-manifest basePath:', actual || '(root)'); \
    console.log('Baked NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL); \
  "

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# next start re-reads next.config.ts — basePath must also be set at runtime
ARG NEXT_PUBLIC_API_URL=https://farmacograph.furkanguven.space/api/v1
ARG NEXT_PUBLIC_BASE_PATH=/studio
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

USER nextjs
EXPOSE 3000

# Full `.next` + `next start` (not `output: 'standalone'`). Empty public HTML with
# working `/studio/_next/*` is almost never missing server.js — check nginx
# `Connection` / `$connection_upgrade` (see deploy/nginx/farmacograph.conf).
# Bind all interfaces; PORT comes from ENV / compose.
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
