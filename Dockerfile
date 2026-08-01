# Self-host de PERZE. No usa `output: standalone` a propósito: el service
# worker (`@serwist/turbopack`) lo compila esbuild en runtime leyendo
# `src/app/sw.ts` desde disco (ver el comentario en `next.config.ts`), así
# que el árbol de `node_modules`/`src` tiene que seguir estando completo en
# producción, no solo lo que el tracer de `standalone` copiaría.
#
# No probado contra un build real en este entorno (sin Docker acá, ver
# CLAUDE.md) — revisalo antes de confiar en él para producción.
FROM node:24-slim AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variables NEXT_PUBLIC_* tienen que existir en build time, no solo en runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "start"]
