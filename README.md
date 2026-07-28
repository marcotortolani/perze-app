# PERZE

PWA de finanzas personales: multi-cuenta, multi-moneda, multi-país, con grupo familiar y módulo
opcional de inversiones. Minimalista, mobile-first, offline-first.

> Registrar un gasto cuesta menos de 5 segundos y 3 decisiones. Todo lo demás se subordina a eso.

## Estado del proyecto

El código actual está en rediseño completo contra el paquete de diseño en `perze-design/`. El
MVP anterior (v0.1.1) quedó archivado en `src/app-old/` como referencia histórica, sin migrar.

Ver el plan de implementación de los primeros cinco bloques (Onboarding, Home, Captura,
Movimientos, Cuentas y monedas) en
[`docs/perze-plan-redesign-first-5-blocks.md`](docs/perze-plan-redesign-first-5-blocks.md).

## Stack

- **Next.js 16** (App Router) · **TypeScript strict** · **Tailwind CSS v4**
- **shadcn/ui** customizado sobre un design system propio (`perze-design/PERZE-Design-System/`)
- **Motion** (ex Framer Motion) para animación · **Lucide** para íconos
- **Dexie.js** (IndexedDB) como persistencia local-first, detrás de una capa de repositorios
  pensada para enchufar **Supabase** (Postgres + Auth + Storage) más adelante
- **TanStack Query v5** · **Zustand** (solo UI efímera) · **Zod v4**
- **next-intl** — ES (rioplatense, idioma fuente) / EN / PT
- **Serwist** (PWA) · **ESLint** (lint) · **Vitest** + **Playwright** (tests)

## Documentación

Todo el paquete de producto y diseño vive en `perze-design/` y se referencia también, copiado,
desde `docs/`:

| Doc                                                                                          | Qué es                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`docs/00-producto.md`](docs/00-producto.md)                                                 | Análisis de producto: features, módulos, roadmap   |
| [`docs/01-arquitectura-datos.md`](docs/01-arquitectura-datos.md)                             | Stack, schema, RLS, estrategia FX y offline        |
| [`docs/02-design-system.md`](docs/02-design-system.md)                                       | Tokens, paleta, tipografía, motion, componentes    |
| [`docs/03-prompts-wireframes.md`](docs/03-prompts-wireframes.md)                             | Mapa de pantallas de baja fidelidad, por bloque    |
| [`docs/04-prompts-ui.md`](docs/04-prompts-ui.md)                                             | Prompts de diseño de alta fidelidad                |
| [`docs/05-prompts-desarrollo.md`](docs/05-prompts-desarrollo.md)                             | `CLAUDE.md` de origen + prompts de implementación  |
| [`docs/perze-plan-redesign-first-5-blocks.md`](docs/perze-plan-redesign-first-5-blocks.md)   | Plan vigente: bloques A–E                          |
| [`perze-design/Mapa-estructural-del-producto/`](perze-design/Mapa-estructural-del-producto/) | Mapa completo del sistema (82 vistas, 12 bloques)  |
| [`perze-design/PERZE-Design-System/`](perze-design/PERZE-Design-System/)                     | Design system empaquetado: tokens + 36 componentes |
| [`perze-design/Bloque-*/`](perze-design/)                                                    | Entregables de alta fidelidad por bloque (A–E)     |

## Estado por bloque

| Bloque | Nombre                                     | Estado         |
| ------ | ------------------------------------------ | -------------- |
| —      | Documentación, tooling y núcleo de dominio | 🔄 En progreso |
| C      | Captura rápida                             | ⬜ Pendiente   |
| B      | Home y navegación                          | ⬜ Pendiente   |
| D      | Movimientos                                | ⬜ Pendiente   |
| E      | Cuentas y monedas                          | ⬜ Pendiente   |
| A      | Onboarding y auth                          | ⬜ Pendiente   |

**Estados posibles:** ⬜ Pendiente · 🔄 En progreso · ✅ Completada

## Estructura

```text
docs/                  documentos de producto/arquitectura/diseño, versionados con el código
perze-design/          paquete de diseño original (wireframes, alta fidelidad, design system)
src/
  app/                 rutas de la app (App Router)
  app-old/             MVP anterior, archivado — no se migra
  design-system/        componentes propios portados desde perze-design/PERZE-Design-System
  lib/
    money/             bigint math, formateo, parser del keypad
    fx/                proveedores de tipo de cambio + resolución de rate
    db/                schema de Dexie
    repos/             capa de repositorios (Dexie hoy, Supabase después)
    offline/           outbox de mutaciones optimistas
  stores/              Zustand (solo estado de UI efímera)
  i18n/                mensajes es/en/pt (next-intl)
```

## Empezar a desarrollar

```bash
pnpm install
pnpm dev
```

Abrí [http://localhost:3000](http://localhost:3000).

```bash
pnpm build   # build de producción
pnpm lint    # ESLint
pnpm test    # Vitest
pnpm e2e     # Playwright
```

## Licencia

A definir antes de liberar como open source (MIT o AGPL — ver `docs/00-producto.md` § 5).
