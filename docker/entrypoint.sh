#!/bin/sh
# Apply pending Postgres migrations, then start the Next.js server.
set -e

# docker compose passes the database as parts so the password can contain any
# character: build the URL here with the user and password percent-encoded.
# An explicit DATABASE_URL (e.g. an external database) takes precedence.
if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
  DATABASE_URL="$(node -e '
    const e = process.env;
    const user = encodeURIComponent(e.POSTGRES_USER || "zeedude");
    const pass = encodeURIComponent(e.POSTGRES_PASSWORD);
    const db = encodeURIComponent(e.POSTGRES_DB || "zeedude");
    process.stdout.write(`postgresql://${user}:${pass}@${e.POSTGRES_HOST || "db"}:${e.POSTGRES_PORT || "5432"}/${db}`);
  ')"
  export DATABASE_URL
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Set DATABASE_URL, or POSTGRES_PASSWORD (plus optional POSTGRES_HOST/USER/DB)" >&2
  exit 1
fi
# The schema declares directUrl for poolers; without a pooler it's the same URL.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/postgres/schema.prisma
exec node server.js
