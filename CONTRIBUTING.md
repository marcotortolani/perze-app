# Contribuir a PERZE

Gracias por el interés. PERZE es un proyecto personal liberado como open source (MIT):
cualquiera puede tomarlo, modificarlo y correrlo donde quiera.

## Antes de empezar

- Leé `CLAUDE.md` en la raíz del repo. Es la memoria del proyecto: decisiones ya cerradas
  (dinero en `bigint`, `needs_fx`, RLS, progresividad por flags) que no se vuelven a discutir
  sin un motivo nuevo. Si tu cambio choca con algo de ahí, decilo en el PR en vez de
  desviarte en silencio.
- `docs/00-producto.md` a `docs/plan-de-trabajo.md` documentan el producto, la arquitectura
  de datos y el estado real del plan de trabajo — son la fuente de verdad de *qué* se
  construye y *por qué*, no `docs/03-prompts-wireframes.md` ni `docs/04-prompts-ui.md`
  (esos son historial de cómo se generó el diseño, no especificación vigente).

## Setup de desarrollo

Ver `docs/self-hosting.md` para el detalle completo. En resumen:

```bash
pnpm install
cp .env.example .env.local   # completá tus credenciales de Supabase
pnpm dev
```

## Antes de abrir un PR

Corré esto localmente — es lo mismo que se corre en cada pantalla nueva durante el
desarrollo del proyecto:

```bash
pnpm lint         # ESLint — cero errores, cero strings hardcodeadas en JSX
npx tsc --noEmit  # TypeScript estricto
pnpm test         # Vitest — toda la lógica pura de negocio tiene test
pnpm build        # el build de producción tiene que pasar limpio
```

## Reglas que se verifican en revisión de código

Estas son las que más cuestan si se rompen — están en `CLAUDE.md` con el detalle completo:

- **Dinero es `bigint`.** Nunca `number`, `parseFloat` ni `toFixed` sobre un monto. Todo pasa
  por `lib/money`.
- **`needs_fx` nunca inventa un tipo de cambio.** Sin cotización, el movimiento se guarda
  igual, sin conversión — nunca `rate = 1`, nunca se bloquea el guardado. Todo agregado que
  suma plata excluye lo no resuelto y muestra el conteo excluido.
- **RLS en cada tabla nueva**, en la misma migración que la crea. Las políticas de `UPDATE`
  llevan `USING` y `WITH CHECK`.
- **Migraciones son append-only.** Una corrección es una migración nueva, nunca se edita una
  ya pusheada.
- **Cero strings hardcodeadas.** Todo texto de UI pasa por `next-intl` (ES/EN/PT), y las tres
  traducciones tienen que tener las mismas claves.
- **No se inventan componentes ni tablas.** Si te hace falta algo que no está en
  `docs/contrato-componentes.md` o en `docs/01-arquitectura-datos.md`, abrí la discusión en
  el PR o el issue antes de escribirlo.

## Estilo de commits

Mensajes en imperativo, describiendo el *por qué* más que el *qué* (el diff ya dice el qué).
No hace falta un formato tipo Conventional Commits, pero sí que el mensaje tenga sentido leído
solo, sin el contexto de la conversación que lo generó.

## Reportar un bug o proponer una feature

Abrí un issue. Para bugs, incluí: qué esperabas, qué pasó, y si es posible un movimiento/cuenta
de ejemplo que lo reproduzca (sin datos reales tuyos — este es un proyecto de finanzas
personales, tratá tus propios datos con el mismo cuidado que le pedimos al código).

## Código de conducta

Sé respetuoso. Sin acoso, sin descalificaciones. Los mantenedores pueden cerrar issues o PRs
que no lo cumplan.
