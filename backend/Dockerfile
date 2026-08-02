# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install ALL dependencies first (this layer is cached as long as
# package*.json don't change — full source changes below won't invalidate it).
COPY package*.json ./
RUN npm ci

# Copy the ENTIRE source (including prisma/schema.prisma) BEFORE generating
# the Prisma client, then run `generate` and `build` chained in a single
# RUN command. This is the pattern Prisma's own Docker deployment docs
# recommend — generating against a partially-copied source (or in a
# separate RUN step from the build that follows it) has been observed to
# occasionally produce a Prisma Client whose types silently lag behind
# the schema (e.g. a newly-added enum missing from the generated d.ts),
# even though the command exits 0. Chaining removes that class of bug
# entirely by guaranteeing both steps run back-to-back against the exact
# same, complete filesystem state.
COPY . .
RUN npx prisma generate && npm run build

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
#
# The DATABASE_URL pre-flight check below exists because its absence
# otherwise surfaces as a cryptic, repeating Prisma schema-validation
# error (P1012) as Railway's restart policy retries the container —
# failing fast with a clear, actionable message is much easier to debug.
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo 'FATAL: DATABASE_URL is not set. On Railway: Variables tab -> add DATABASE_URL -> reference your Postgres plugin (e.g. ${{Postgres.DATABASE_URL}}). See docs/deployment-guide.md.'; exit 1; fi && npx prisma db push --skip-generate && npm run start:prod"]
