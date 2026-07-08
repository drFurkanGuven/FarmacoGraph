# FarmacoGraph Curation Studio — production image
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=https://farmacograph.furkanguven.space/api/v1
ARG NEXT_PUBLIC_BASE_PATH=/studio
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN echo "Building Studio with NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}" \
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

CMD ["npm", "run", "start"]
