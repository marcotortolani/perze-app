@AGENTS.md

# PERZE — Contexto del proyecto

App PWA de finanzas personales: gastos, cuentas, presupuestos e inversiones, con soporte
multi-cuenta, multi-moneda y multi-país, y modo de grupo familiar. Proyecto personal que se va
a liberar como open source.

En rediseño completo contra `perze-design/`. Plan vigente:
`docs/perze-plan-redesign-first-5-blocks.md`. El MVP anterior quedó archivado en
`src/app-old/` — no se toca ni se migra.

## Stack

- Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4
- shadcn/ui customizado · Motion (`motion`) · Lucide
- **Dexie.js** (IndexedDB) como persistencia local-first hoy, detrás de una capa de
  repositorios (`lib/repos/`) pensada para enchufar **Supabase** (Postgres, Auth, Storage,
  Realtime, Edge Functions) más adelante sin rediseñar pantallas
- TanStack Query v5 · Zustand (solo estado de UI efímera, nunca datos de dominio) · Zod v4
- **next-intl** — ES rioplatense (idioma fuente) / EN / PT. Cero strings hardcodeadas.
- Serwist (PWA) · **ESLint** (lint + format — no Biome) · Vitest + Playwright

## Reglas de código no negociables

- **Dinero**: `bigint` en unidades mínimas. NUNCA `number`, `float` ni `parseFloat` para montos.
  Todo cálculo de dinero pasa por `lib/money`.
- **Formateo**: ningún componente formatea plata a mano. Solo `<Amount>`.
- **IDs**: se generan en el cliente (UUID v7) antes de la mutación. Idempotencia.
- **Mutaciones**: siempre optimistas, siempre pasan por el outbox (`lib/offline/outbox.ts`).
- **FX**: el cliente NUNCA llama a una API de cotización. Solo a `/api/fx`.
- **Repositorios**: ninguna pantalla toca Dexie directo. Todo pasa por `lib/repos/*`, que es
  la costura para cambiar a Supabase después.
- **Módulos opcionales**: antes de renderizar cualquier cosa de un módulo, chequear
  `household.enabled_modules`. Si está apagado, no se importa ni el código.
- **i18n**: cero strings hardcodeadas. Todo por `next-intl`, ES/EN/PT.

## Gotchas de Next.js 16

- `middleware.ts` → `proxy.ts` (runtime Node)
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` son **async**
- `revalidateTag(tag, profile)` requiere perfil de `cacheLife`; `updateTag()` en Server Actions
  para read-your-writes
- Turbopack es el bundler por defecto
- Todo slot de ruta paralela necesita su `default.js` explícito
- No existe `next lint` — usamos ESLint directo (`pnpm lint`)

## Reglas de diseño (ver `docs/02-design-system.md`)

- Minimalista: ~90% neutros. Color solo cuando significa algo.
- Presupuesto por pantalla: 1 cifra héroe · 1 color de marca fuera de los gráficos · 1 acción
  primaria · 3 niveles tipográficos · 5 elementos interactivos sobre el pliegue · 0 bordes de
  caja evitables · 0 iconos decorativos. Si se excede, no se comprime: se mueve a otra pantalla
  o a un drawer, y se declara por escrito.
- Sin `<select>` nativo. Sin `<input type="number">` para montos.
- Ningún target < 44×44. Primario de 56-64px en los últimos 200px de la pantalla.
- Ninguna transición de interfaz > 320ms. Cuatro excepciones no bloqueantes: count-up 400ms,
  secuencia de guardado ≤700ms, celebración 900ms, dibujado de línea en gráficos 600ms.
- `prefers-reduced-motion` respetado + ajuste propio de intensidad (Completa/Reducida/Mínima).
- Gastos en texto neutro; solo los ingresos se destacan en aqua. Nunca verde/rojo como
  polaridad de dinero.
- Selección por **superficie** es el default (segmentados, día activo, cuenta activa, categoría
  activa); el relleno de marca (violeta) queda reservado para chip activo, tab activo y switch
  encendido.

## Design system

Componentes propios portados desde `perze-design/PERZE-Design-System/` a
`src/design-system/{core,money,finance,nav,feedback,charts}/`. Referencia viva en
`/dev/components`; tokens en `/dev/tokens`. Antes de crear un componente nuevo, buscar si ya
existe ahí o en el `readme.md` de `perze-design/PERZE-Design-System/`.

## Estructura

Ver `docs/01-arquitectura-datos.md` § 5 y el detalle real en `README.md`.

## Comandos

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm e2e` · `pnpm lint`
