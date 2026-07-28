# PERZE

PWA de finanzas personales: multi-cuenta, multi-moneda, multi-país, con grupo familiar y módulo
opcional de inversiones. Minimalista, mobile-first, offline-first.

> Registrar un gasto cuesta menos de 5 segundos y 3 decisiones. Todo lo demás se subordina a eso.

## Estado del proyecto

El rediseño completo contra el paquete de diseño en `perze-design/` está terminado: los cinco
bloques del plan (Onboarding, Home, Captura, Movimientos, Cuentas y monedas) están
implementados y verificados (build, lint, Vitest y Playwright en verde), más internacionalización
de punta a punta (ES/EN/PT) sobre toda la app. El MVP anterior (v0.1.1) ya no está en el árbol de
trabajo (vivía en `src/app-old/`, ignorado por git y borrado tras la migración).

Ver el plan original en
[`docs/perze-plan-redesign-first-5-blocks.md`](docs/perze-plan-redesign-first-5-blocks.md) y el
detalle completo de lo entregado en cada bloque en [`CHANGELOG.md`](CHANGELOG.md) (`[0.2.0]` y
`[0.3.0]`).

## Stack

- **Next.js 16** (App Router, Turbopack) · **TypeScript strict** · **Tailwind CSS v4**
- Design system propio en `src/design-system/` (portado desde
  `perze-design/PERZE-Design-System/`); `shadcn` queda solo como scaffolding puntual
  (`src/components/ui/`, apenas `Toaster` en uso real)
- **Motion** (ex Framer Motion) para animación · **Phosphor Icons** para íconos (reemplazó a
  Lucide)
- **Dexie.js** (IndexedDB) como persistencia local-first, detrás de una capa de repositorios
  (`src/lib/repos/`) pensada para enchufar **Supabase** (Postgres + Auth + Storage) más adelante
- **TanStack Query v5** · **Zustand** (solo UI efímera) · **Zod v4**
- **next-intl** — ES (rioplatense, idioma fuente) / EN / PT, aplicado en toda la app (design
  system, features, las 17 rutas, manifest de la PWA); selector de idioma en "Más"
- **Serwist** (PWA) · **ESLint** (lint, incluye guardarraíl `react/jsx-no-literals` contra
  strings sueltos) · **Vitest** (119 tests) + **Playwright** (4 E2E)

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

El mapa completo del producto son 12 bloques (82 vistas,
[`perze-design/Mapa-estructural-del-producto/`](perze-design/Mapa-estructural-del-producto/)).
Los primeros cinco (A–E) están implementados; F–K quedan por diseñar e implementar.

| Bloque | Nombre                                     | Estado       |
| ------ | ------------------------------------------ | ------------ |
| —      | Documentación, tooling y núcleo de dominio | ✅ Completo  |
| C      | Captura rápida                             | ✅ Completo  |
| B      | Home y navegación                          | ✅ Completo  |
| D      | Movimientos                                | ✅ Completo  |
| E      | Cuentas y monedas                          | ✅ Completo  |
| A      | Onboarding y auth                          | ✅ Completo  |
| F      | Presupuestos y metas                       | ⬜ Pendiente |
| G      | Recurrentes y deudas                       | ⬜ Pendiente |
| H      | Análisis                                   | ⬜ Pendiente |
| I      | Inversiones (módulo opcional)              | ⬜ Pendiente |
| J      | Grupo familiar (módulo opcional)           | ⬜ Pendiente |
| K      | Ajustes                                    | ⬜ Pendiente |

**Estados posibles:** ⬜ Pendiente · 🔄 En progreso · ✅ Completo

Cross-cutting, aplicado sobre A–E: internacionalización completa (next-intl, ES/EN/PT),
responsive (Sidebar de escritorio), auditoría PWA (manifest dinámico por idioma, splash screens,
iconografía) y migración de íconos Lucide → Phosphor. Detalle en [`CHANGELOG.md`](CHANGELOG.md).
El bloque **L — Estados transversales** (sistemas de estado vacío/skeleton, no pantallas propias)
ya se ejecutó como parte del design system portado en la Fase 3 del redesign, antes de A–E.

### Bloques pendientes de diseñar/implementar

| Bloque | Qué cubre                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F**  | Presupuestos y metas — overview con "disponible para gastar hoy", bullet charts por categoría, alertas de excedido; metas de ahorro con anillo de progreso y simulador de aportes (7 vistas) |
| **G**  | Recurrentes y deudas — suscripciones detectadas automáticamente, calendario de vencimientos, planes de cuotas con tabla de amortización (6 vistas)            |
| **H**  | Análisis — KPIs, categorías (drill-down), tendencias, flujo Sankey, patrimonio neto, multi-moneda/FX, inflación, calendario heatmap, comercios, insights, resumen semanal, Wrapped, exportar/reportes (14 vistas) |
| **I**  | Inversiones (módulo opcional) — portfolio overview, posiciones, detalle de instrumento, registrar operación/renta, allocation/rebalanceo, rendimiento (TWR/XIRR), calendario de renta futura (12 vistas) |
| **J**  | Grupo familiar (módulo opcional) — invitar miembro, permisos/visibilidad, gastos compartidos, dividir gasto, liquidar (settle up), comparativa entre miembros, actividad del household (10 vistas) |
| **K**  | Ajustes — perfil, preferencias, módulos, categorías, tags, reglas de auto-categorización, fuentes FX, importar, exportar/backup, seguridad, notificaciones, acerca de (13 vistas) |

Detalle vista por vista en `docs/03-prompts-wireframes.md` (PROMPT W6–W10). Además del backend
real (Supabase, hoy todo local-first sobre Dexie) y de estos bloques, quedan diferidas dos
features de captura (C4 completo — moneda distinta a la de la cuenta — y C10 — foto de ticket);
"Ajustes", "Importar/Exportar" y "Acerca de" en "Más" siguen como stubs hasta que se implemente K.

## Estructura

```text
docs/                  documentos de producto/arquitectura/diseño, versionados con el código
perze-design/          paquete de diseño original (wireframes, alta fidelidad, design system)
e2e/                   tests E2E (Playwright)
messages/              diccionarios es/en/pt (next-intl)
src/
  app/                 rutas de la app (App Router) — ver CHANGELOG [0.3.0] para el mapa completo
  design-system/       componentes propios portados desde perze-design/PERZE-Design-System
  features/            flujos que componen varias pantallas (captura, movimientos, cuentas)
  hooks/               data hooks (TanStack Query) sobre los repositorios
  i18n/                routing, negociación de locale, Server Action de idioma, formateo
  lib/
    money/             bigint math, formateo, parser del keypad
    fx/                proveedores de tipo de cambio + resolución de rate
    db/                schema de Dexie + migraciones versionadas
    repos/             capa de repositorios (Dexie hoy, Supabase después)
    offline/           outbox de mutaciones optimistas
    reference/         datos de referencia (categorías, países, monedas, tipos de cuenta)
  stores/              Zustand (solo estado de UI efímera)
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
