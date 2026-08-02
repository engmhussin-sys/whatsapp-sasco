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
  echo ""
  echo "DIAGNOSTIC (variable NAMES only, no values/secrets are ever printed):"
  echo "Environment variables actually present in this container:"
  env | cut -d= -f1 | sort
  echo ""
  echo "If nothing above starts with DATABASE_URL, PG, or POSTGRES, no Postgres"
  echo "plugin variable is reaching this service at all — check: (1) a Postgres"
  echo "plugin actually exists in this Railway PROJECT, (2) DATABASE_URL was"
  echo "added under the SAME environment (e.g. 'production') this service is"
  echo "deployed to, not a different one."
  exit 1
fi

echo "[$(date -u +%H:%M:%S)] Syncing database schema (prisma db push)..."
npx prisma db push --skip-generate
echo "[$(date -u +%H:%M:%S)] Schema sync complete."

echo "[$(date -u +%H:%M:%S)] Starting server..."
exec npm run start:prod
