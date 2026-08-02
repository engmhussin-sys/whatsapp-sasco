#!/bin/sh
# Container entrypoint. Deliberately a real script file rather than an
# inline shell one-liner in Dockerfile CMD / railway.json startCommand —
# confirmed empirically that Railway's startCommand does NOT wrap the
# value in a shell before executing it (it failed with "The executable
# `if` could not be found", meaning it split our command on whitespace
# and tried to exec "if" as a binary). Putting the logic here means the
# command Railway/Docker actually needs to run is just `sh start.sh` —
# two simple tokens, immune to that class of parsing difference entirely.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set."
  echo "On Railway: Variables tab -> add DATABASE_URL -> reference your Postgres plugin (e.g. \${{Postgres.DATABASE_URL}})."
  echo "See docs/deployment-guide.md for the full list of required variables."
  exit 1
fi

echo "[$(date -u +%H:%M:%S)] Syncing database schema (prisma db push)..."
npx prisma db push --skip-generate
echo "[$(date -u +%H:%M:%S)] Schema sync complete."

echo "[$(date -u +%H:%M:%S)] Starting server..."
exec npm run start:prod
