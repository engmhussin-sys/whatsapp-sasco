# ---- Build stage ----------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Alpine's minimal base image does NOT ship the openssl package itself
# (only some baseline crypto libs) — Prisma's engines shell out to `openssl
# version` to detect which engine binary (openssl-1.1.x vs openssl-3.0.x)
# to use. Without this package, that detection silently fails and Prisma
# guesses wrong (defaults to openssl-1.1.x), then downloads/runs an engine
# binary that's incompatible with what's actually available in the
# container — confirmed in production as:
#   "Error: Could not parse schema engine response: SyntaxError:
#    Unexpected token 'E', "Error load"... is not valid JSON"
# (the engine process itself was crashing on a missing shared library and
# printing a text error where Prisma's CLI expected JSON). Installing
# openssl explicitly fixes detection at the source.
RUN apk add --no-cache openssl ffmpeg

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

# Same reason as the builder stage — this stage independently runs
# `prisma db push` (via start.sh) at container startup, which needs the
# schema-engine to detect OpenSSL correctly too.
# ffmpeg هنا هو الأهم فعلياً — هذه المرحلة (production) هي التي تُشغِّل
# التطبيق على Railway، حيث تُستدعى WaveformExtractorService/
# VideoThumbnailExtractorService فعلياً وقت التشغيل.
RUN apk add --no-cache openssl ffmpeg

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY start.sh ./start.sh
RUN chmod +x start.sh

RUN mkdir -p uploads
EXPOSE 3000
# NOTE: uses `db push` (schema sync) rather than `migrate deploy` because
# no migration history exists yet — see docs/deployment-guide.md for why,
# and for the one-time step to switch to proper migrations.
#
# Runs via start.sh rather than an inline shell command — see that
# file's header comment for exactly why (confirmed Railway does not
# shell-wrap startCommand, so any inline `if`/`&&` syntax fails with
# "the executable `if` could not be found").
CMD ["sh", "start.sh"]
