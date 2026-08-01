# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ---- Production stage ------------------------------------------------------
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads
EXPOSE 3000
# NOTE: uses `db push` (schema sync) rather than `migrate deploy` because
# no migration history exists yet — see docs/deployment-guide.md for why,
# and for the one-time step to switch to proper migrations.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
