#!/bin/sh
# Apply pending Postgres migrations, then start the Next.js server.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi
# The schema declares directUrl for poolers; without a pooler it's the same URL.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/postgres/schema.prisma
exec node server.js
