# syntax=docker/dockerfile:1
# Production image: Next.js standalone server + Postgres migrations at start.
# Build and run with docker compose (see README "Deploying with Docker").

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dependencies (postinstall generates the Postgres Prisma client) ----
FROM base AS deps
# Placeholder URL only selects the Postgres schema; nothing connects to it.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Everything postinstall (scripts/prisma.mjs) imports.
COPY scripts/prisma.mjs scripts/prisma-schema.mjs scripts/project-env.mjs ./scripts/
RUN npm ci --no-audit --no-fund

# ---- build ----
FROM base AS builder
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# NEXT_PUBLIC_* values are inlined at build time, so they're build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_REFERRAL_CODE
ARG NEXT_PUBLIC_REFERRAL_URL
ARG NEXT_PUBLIC_DISCORD_URL
ARG NEXT_PUBLIC_X_URL
ARG NEXT_PUBLIC_KICK_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_REFERRAL_CODE=$NEXT_PUBLIC_REFERRAL_CODE \
    NEXT_PUBLIC_REFERRAL_URL=$NEXT_PUBLIC_REFERRAL_URL \
    NEXT_PUBLIC_DISCORD_URL=$NEXT_PUBLIC_DISCORD_URL \
    NEXT_PUBLIC_X_URL=$NEXT_PUBLIC_X_URL \
    NEXT_PUBLIC_KICK_URL=$NEXT_PUBLIC_KICK_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Prisma CLI for `migrate deploy` at startup (same version as the lockfile) ----
FROM base AS prisma-cli
COPY package-lock.json /tmp/package-lock.json
WORKDIR /opt/prisma-cli
RUN PRISMA_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version")" \
  && npm init -y >/dev/null \
  && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}"

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    FALLBACK_CACHE_DIR=/var/cache/zeedude
RUN groupadd --system app && useradd --system --gid app --home-dir /app app \
  && mkdir -p /var/cache/zeedude && chown app:app /var/cache/zeedude

# Standalone output doesn't include public/ or .next/static/; copy them beside server.js.
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/prisma/postgres ./prisma/postgres
COPY --from=prisma-cli /opt/prisma-cli /opt/prisma-cli
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh

USER app
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
