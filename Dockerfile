# syntax=docker/dockerfile:1.7
#
# AeroLMS - obraz aplikace pro kontejnerové nasazení (předváděcí instance na Coolify).
# Nasazení u zákazníka (Windows Server, PM2, IIS) tento soubor nepoužívá.
#
# Next.js standalone, uživatel uid/gid 1001, curl pro healthcheck, port 3000.
# Prisma generuje klienta v build fázi na stejné platformě (musl), na které poběží.

# -----------------------------------------------------------------------------
# base
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: Prisma podle něj vybírá dotazovací engine (linux-musl-openssl-3.0.x)
RUN apk add --no-cache openssl

# -----------------------------------------------------------------------------
# deps - všechny závislosti pro build. Skripty vypnuté: postinstall (prisma generate)
# tu ještě nemá schéma a husky v obrazu nemá co dělat; generate běží ve fázi build.
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund

# -----------------------------------------------------------------------------
# build - prisma generate + next build (standalone)
# -----------------------------------------------------------------------------
FROM deps AS build
COPY . .
ENV NEXT_OUTPUT=standalone
# Sentry se v předváděcí instanci nepoužívá; proměnná musí platit už při buildu,
# protože next.config.ts podle ní zapojuje plugin Sentry.
ENV NEXT_PUBLIC_SENTRY_DISABLED=true
RUN npx prisma generate \
 && npx next build

# -----------------------------------------------------------------------------
# web
# -----------------------------------------------------------------------------
FROM base AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_SENTRY_DISABLED=true
ENV FILE_STORAGE_PATH=/data/uploads
RUN apk add --no-cache curl \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs \
 && mkdir -p /data/uploads \
 && chown nextjs:nodejs /data/uploads

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health >/dev/null || exit 1
ENTRYPOINT ["/bin/sh", "-c", "exec env HOSTNAME=0.0.0.0 node server.js"]
