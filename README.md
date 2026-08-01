# PERZE

App PWA de finanzas personales — gastos, cuentas, presupuestos e inversiones, con soporte
multi-cuenta, multi-moneda y multi-país, y modo de grupo familiar opcional. Local-first,
mobile-first, minimalista. Licencia MIT.

**La app se juzga por una sola métrica: cargar un gasto en menos de 5 segundos y 3
decisiones.** Todo lo demás se subordina a eso.

## Qué es

- **Local-first de verdad.** Los movimientos se guardan en el teléfono (IndexedDB vía Dexie)
  primero, y se sincronizan con Supabase después — cargar un gasto nunca espera a la red.
- **Multi-moneda sin inventar tipos de cambio.** Un movimiento sin cotización disponible se
  guarda igual, sin conversión — nunca con una tasa inventada, nunca bloqueado.
- **Progresivo, no por perfiles.** La complejidad de la interfaz se revela según cuántas
  monedas usás, cuántos miembros hay en el grupo, y qué módulos opcionales prendiste — no
  hay un campo "perfil" en el modelo de datos.
- **Seis módulos opcionales**, apagados por defecto: presupuestos, metas, recurrentes,
  deudas, inversiones, grupo familiar. Apagar uno oculta, nunca borra.

## Stack

- Next.js 16 (App Router) · TypeScript estricto · Tailwind CSS v4
- shadcn/ui customizado · Motion · Phosphor Icons
- Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- TanStack Query v5 · Zustand · Dexie (outbox offline) · Zod v4
- Serwist (PWA) · Vitest + Playwright

## Empezar

```bash
pnpm install
cp .env.example .env.local   # completá tus credenciales de Supabase
pnpm dev
```

Ver [`docs/self-hosting.md`](docs/self-hosting.md) para el setup completo de Supabase
(migraciones, Edge Functions, deploy).

## Comandos

| Comando          | Qué hace                              |
| ---------------- | -------------------------------------- |
| `pnpm dev`        | Servidor de desarrollo                 |
| `pnpm build`       | Build de producción                    |
| `pnpm test`        | Corre la suite de Vitest               |
| `pnpm e2e`         | Corre los tests end-to-end de Playwright |
| `pnpm lint`        | ESLint                                 |
| `pnpm db:types`    | Regenera los tipos de Supabase          |
| `pnpm db:push`     | Aplica migraciones al proyecto enlazado |

## Documentación

- [`CLAUDE.md`](CLAUDE.md) — memoria del proyecto: decisiones cerradas, orden de autoridad
  entre documentos, y las reglas que más cuestan si se rompen (dinero, `needs_fx`, RLS).
- [`docs/00-producto.md`](docs/00-producto.md) — qué se construye y por qué.
- [`docs/01-arquitectura-datos.md`](docs/01-arquitectura-datos.md) — schema completo,
  estrategia de FX y offline.
- [`docs/02-design-system.md`](docs/02-design-system.md) — tokens, tipografía, motion, reglas
  de gráficos.
- [`docs/contrato-componentes.md`](docs/contrato-componentes.md) — la API de cada componente
  de la biblioteca de diseño.
- [`docs/plan-de-trabajo.md`](docs/plan-de-trabajo.md) — estado real de cada pantalla/feature
  del proyecto, ítem por ítem.
- [`docs/self-hosting.md`](docs/self-hosting.md) — cómo correrlo vos mismo.

`docs/03-prompts-wireframes.md` y `docs/04-prompts-ui.md` son historial de cómo se generó el
diseño, no especificación vigente — ver la nota de autoridad de documentos en `CLAUDE.md`.

## Contribuir

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licencia

[MIT](LICENSE) — tomalo, modificalo, correlo donde quieras.
