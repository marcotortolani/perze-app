# Plan de desarrollo — App de Finanzas Personales

**Última actualización:** 2026-05-30 (pendientes de Fase 0 resueltos)  
**Stack:** Next.js 16 · Tailwind v4 · shadcn/ui · Zustand · Gemini AI · PWA

---

## Estado de fases

| Fase | Nombre                            | Estado        | Versión | Fecha      |
| ---- | --------------------------------- | ------------- | ------- | ---------- |
| 0    | Fundación (MVP inicial)           | ✅ Completada | v0.1.1  | 2026-05-30 |
| 1    | Corrección de bugs críticos       | ⬜ Pendiente  | —       | —          |
| 2    | Seguridad y robustez              | ⬜ Pendiente  | —       | —          |
| 3    | Quick wins UX + datos útiles      | ⬜ Pendiente  | —       | —          |
| 4    | Funcionalidades core de finanzas  | ⬜ Pendiente  | —       | —          |
| 5    | Funcionalidades avanzadas (AR/UY) | ⬜ Pendiente  | —       | —          |
| 6    | Infraestructura y escala          | ⬜ Pendiente  | —       | —          |

**Estados posibles:** ⬜ Pendiente · 🔄 En progreso · ✅ Completada · ⏸️ Pausada · ❌ Descartada

---

## Fase 0 — Fundación (MVP inicial)

**Estado:** ✅ Completada · **Versión:** v0.1.0 · **Fecha:** 2026-05-30

### Qué se construyó

- Scaffold Next.js 16, Tailwind v4, shadcn/ui, Zustand con persist
- Sistema de tipos y stores: transacciones, configuración, tasas, categorías, auth mock
- Dashboard con balance multi-moneda, gráfico 6 meses, breakdown por país
- Movimientos: lista con filtros, pills de tipo, sheet de alta/edición
- Inversiones: vista básica por categoría
- Análisis IA: insights con Gemini 2.5 Flash, escaneo de tickets
- Configuración: monedas, tasas manuales, países, tema claro/oscuro, 5 acentos
- Auth mock: login, registro, recuperar, restablecer contraseña
- PWA: manifest, service worker (Serwist), soporte offline
- Diseño fintech premium (Outfit font, dark mode por defecto, acento esmeralda)

### Pendiente que quedó de esta fase

- ~~Íconos PNG del PWA no generados (solo existe SVG)~~ — ✅ Resuelto en v0.1.1
- ~~Autenticación completamente mock (contraseñas en texto plano en localStorage)~~ — ✅ Resuelto en v0.1.1 (hash FNV-1a)
- ~~Sin validación en mutaciones del store~~ — ✅ Resuelto en v0.1.1 (Zod en transactions-store)
- ~~`formatMoney` produce `$-1.200` en vez de `-$1.200` para negativos~~ — ✅ Resuelto en v0.1.1

---

## Fase 1 — Corrección de bugs críticos

**Estado:** ⬜ Pendiente · **Versión:** — · **Fecha:** —

### Objetivo

Corregir todos los bugs confirmados que afectan la correctitud de datos, la experiencia del usuario o la instalabilidad del PWA. Sin nuevas funcionalidades.

### Items a resolver

#### 🔴 Críticos

**[BUG-C1] Contraseñas en texto plano en localStorage**

- **Archivo:** `src/stores/auth-store.ts:90,199`
- **Fix:** Agregar `partialize` al persist para excluir `_users` del storage. Solo persistir `currentUser` (sin password).
- **Nota:** La solución definitiva es la autenticación real (Fase 6), pero este fix elimina la exposición inmediata.

```ts
partialize: (state) => ({
  currentUser: state.currentUser,
  isAuthenticated: state.isAuthenticated,
})
```

**[BUG-C2] Íconos PNG del PWA inexistentes**

- **Archivo:** `public/manifest.webmanifest`, `public/icons/`
- **Fix:** Generar `icon-192.png`, `icon-512.png` e `icon-192-maskable.png` desde el SVG existente usando `sharp`. Separar entradas `any` y `maskable` en el manifest.
- **Herramienta:** `pnpm add -D sharp` + script de generación.

#### 🟠 Altos

**[BUG-H1] `formatMoney` produce `$-1.200` en negativos**

- **Archivo:** `src/lib/money.ts:17`
- **Fix:** Separar el signo de la concatenación del símbolo:

```ts
const sign = amount < 0 ? '-' : ''
const formatted = new Intl.NumberFormat(locale, { ... }).format(Math.abs(amount))
return `${sign}${currency.symbol}${formatted}`
```

**[BUG-H2] `useMemo` con `Date` inestables — memoización rota en el dashboard**

- **Archivo:** `src/app/(app)/page.tsx:179-194`
- **Problema:** `getPeriodRange(period)` crea objetos `Date` nuevos en cada render → los memos de `filteredTransactions`, `totals` y `countryBreakdown` se recalculan en cada render.
- **Fix:** Memoizar el rango de fechas primero:

```ts
const { from, to } = useMemo(() => getPeriodRange(period), [period])
```

**[BUG-H3] Pérdida silenciosa de datos al cerrar el sheet de transacciones**

- **Archivo:** `src/components/transaction-sheet.tsx:289`
- **Fix:** Verificar `formState.isDirty` antes de cerrar sin guardar:

```ts
onOpenChange={(v) => {
  if (!v && form.formState.isDirty) {
    if (!confirm('¿Descartar los cambios?')) return
  }
  if (!v) onClose()
}}
```

**[BUG-H4] Formulario de transacción inutilizable sin monedas/países configurados**

- **Archivo:** `src/components/transaction-sheet.tsx:360-397`
- **Fix:** Agregar empty state en los selects de moneda y país con link a Configuración. Mostrar mensaje de error para campos `currencyCode` y `countryCode`.

**[BUG-H5] `BottomNav` visible durante hidratación sin sesión activa**

- **Archivo:** `src/app/(app)/layout.tsx:38`
- **Fix:** `{hydrated && isAuthenticated && <BottomNav />}`

#### 🟡 Medios

**[BUG-M1] `convertAmount` no guarda contra `NaN` en tasas**

- **Archivo:** `src/lib/money.ts:40`
- **Fix:** `if (!fromRate.perUSD || !isFinite(fromRate.perUSD)) return null`

**[BUG-M2] Ordenamiento inconsistente de transacciones recientes**

- **Archivos:** `src/stores/transactions-store.ts:56` y `src/app/(app)/page.tsx:228`
- **Fix:** Unificar criterio de ordenamiento por `t.date` en ambos lugares.

**[BUG-M3] Totales incompletos sin advertencia por tasas faltantes**

- **Archivo:** `src/lib/aggregations.ts:91`
- **Fix:** Retornar `{ total, skippedCount }` desde `computeTotals` y mostrar banner de advertencia en el dashboard cuando `skippedCount > 0`.

### Deuda técnica asociada

- Extraer schemas Zod de `transaction-sheet.tsx` a `src/lib/schemas.ts` para reutilizar en los stores
- Validación en `addTransaction` y `updateTransaction` antes de persistir

---

## Fase 2 — Seguridad y robustez de la API

**Estado:** ⬜ Pendiente · **Versión:** — · **Fecha:** —

### Objetivo

Asegurar las rutas de API y agregar validaciones de entrada. Prerequisito para cualquier despliegue en producción accesible públicamente.

### Items

**[SEC-1] Rutas de IA sin autenticación**

- **Archivos:** `src/app/api/ai/insights/route.ts`, `src/app/api/ai/scan-receipt/route.ts`
- **Problema:** Cualquier persona puede hacer POST y consumir la cuota de Gemini.
- **Fix corto plazo:** Agregar un secret compartido vía env var (`API_SECRET`) que el cliente envía en header `x-api-secret`. Mientras no haya auth real, esto limita el abuso.
- **Fix largo plazo:** Middleware de sesión real (Fase 6).

**[SEC-2] Upload de imagen sin validación**

- **Archivo:** `src/app/api/ai/scan-receipt/route.ts:51-53`
- **Fix:** Allowlist de MIME types + límite de tamaño:

```ts
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
if (!ALLOWED_MIME.includes(imageFile.type))
  return error(400, 'Tipo no permitido')
if (imageFile.size > MAX_SIZE) return error(400, 'Archivo demasiado grande')
```

**[SEC-3] Reseteo de contraseña sin verificación**

- **Archivo:** `src/stores/auth-store.ts:133-178`
- **Fix:** Generar un token temporal con expiración en `requestPasswordReset`. Requerir ese token en `resetPassword`. Almacenar el token en un Map en memoria (no en localStorage). Solución completa solo llega con auth real (Fase 6).

**[TECH-1] Centralizar manejo de errores en rutas API**

- Crear wrapper `withErrorHandling(handler)` y aplicarlo a todas las rutas
- Logging consistente de errores con contexto (sin datos sensibles)

**[TECH-2] Validación en mutaciones del store**

- Agregar `src/lib/schemas.ts` con schema Zod compartido de `Transaction`
- Validar en `addTransaction` y `updateTransaction` antes de persistir
- Retornar `{ success: boolean, error?: string }` en lugar de `void`

**[TECH-3] `partialize` explícito en todos los stores**

- Revisar `transactions-store.ts`, `settings-store.ts`, `rates-store.ts`
- Excluir datos derivados/calculados del persist
- Documentar qué se persiste y por qué en cada store

---

## Fase 3 — Quick wins de UX y datos útiles

**Estado:** ⬜ Pendiente · **Versión:** — · **Fecha:** —

### Objetivo

Mejoras de alto impacto y bajo esfuerzo. Features que un usuario de Argentina/Uruguay necesita en el día a día y que se pueden implementar sin cambios de infraestructura.

### Items

**[UX-1] Backup y restauración de datos (JSON export/import)**

- En Configuración: botón "Exportar datos" → descarga JSON con todo el estado de Zustand
- Botón "Restaurar desde archivo" → parse + validación Zod + carga al store
- Impacto: red de seguridad mínima antes de tener sync en la nube

**[UX-2] Exportación a CSV**

- Filtrar transacciones por rango + exportar como CSV para contador/monotributista
- Columnas: fecha, descripción, categoría, tipo, monto, moneda, país, notas
- Un botón en la página de movimientos

**[UX-3] Sincronización automática de tasas (dólar blue, MEP, CCL, oficial)**

- API gratuita y sin key: `https://dolarapi.com/v1/dolares`
- Botón "Actualizar tasas" en Configuración → fetch + actualización automática
- Indicador de cuándo fue la última actualización
- Mostrar dólar blue prominentemente en el hero card del dashboard
- Manual override sigue disponible

**[UX-4] Donut chart de gastos por categoría en el dashboard**

- Debajo del bar chart mensual
- Top 5 categorías del período seleccionado con montos y porcentajes
- Recharts `PieChart` — datos disponibles vía `groupByCategory` existente

**[UX-5] Presets de fecha en filtros**

- Chips en el FilterSheet: "Esta semana", "Esta quincena", "Este mes", "Mes pasado", "Último trimestre"
- Especialmente útil para Argentina (quincena de cobro de sueldo)
- Reduce 4-6 taps a 1

**[UX-6] Skeleton loaders en dashboard**

- Reemplazar renders vacíos con skeletons pulsantes para: hero card, bar chart, lista reciente
- Previene flashes de estado vacío → lleno

**[UX-7] Banner offline + indicador de tasas desactualizadas**

- Banner sutil cuando el dispositivo está offline
- Indicador "Tasas actualizadas hace Xh" con link directo a Configuración cuando >6 horas

**[UX-8] Onboarding con datos de ejemplo**

- En primer uso: flujo de 3 pasos (país, moneda principal, cargar datos demo)
- Pre-poblar transacciones argentinas/uruguayas realistas para mostrar el valor antes de datos reales

**[UX-9] FAB expandible de "Nuevo movimiento"**

- En Dashboard y Movimientos: FAB que expande en 3 opciones (Gasto / Ingreso / Inversión)
- Acción más frecuente en 1 tap en lugar de 2-3

**[UX-10] Swipe-to-delete en items de transacción**

- Swipe left sobre un item revela botón de eliminar (con confirmación)
- Reduce 3 taps a 1 gesto + confirmación
- Librería: `react-swipeable` o CSS transform + touch events

---

## Fase 4 — Funcionalidades core de finanzas

**Estado:** ⬜ Pendiente · **Versión:** — · **Fecha:** —

### Objetivo

Agregar las funcionalidades que convierten la app de un tracker básico a una herramienta de gestión financiera real para el contexto argentino/uruguayo.

### Items

**[FEAT-1] Múltiples tasas de dólar (Blue, MEP, CCL, Oficial)**

- Soportar más de una tasa por par de monedas, cada una con nombre/label
- En el transaction sheet: selector de tasa al registrar transacción en ARS
- En el hero card: mostrar las tres tasas USD principales side-by-side
- En tasas de `dolarapi.com`: mapeo automático a los slots configurados

**[FEAT-2] Input de monto con conversión rápida ARS ↔ USD**

- Al ingresar monto, toggle para ver el equivalente en otra moneda según la tasa seleccionada
- Teclado numérico grande automático en mobile
- Ejemplo: ingresar `$60.000 ARS` → muestra `≈ $50 USD (blue)` en tiempo real

**[FEAT-3] Transacciones recurrentes**

- Campo "Repetir" en el transaction sheet: Nunca / Semanal / Quincenal / Mensual / Anual
- Generación automática de instancias al abrir la app
- Sección "Próximos gastos fijos" en el dashboard para el resto del mes
- Modelo de datos: `recurrenceRule` en `Transaction` + store de `scheduled-transactions`

**[FEAT-4] Presupuestos por categoría**

- Nueva entidad `Budget`: categoría, monto límite, período (mensual por defecto)
- Barra de progreso por categoría en el dashboard y en movimientos
- Alerta visual al superar el 80% del presupuesto
- Nuevo store `budgets-store.ts`

**[FEAT-5] Metas de ahorro**

- Nueva entidad `SavingsGoal`: nombre, monto objetivo, moneda, fecha límite
- Barra de progreso, fecha proyectada de cumplimiento, cuánto ahorrar por mes
- Metas comunes presets: "Reserva dólares", "Viaje", "Auto", "Refacción"
- Integración con la sección de inversiones para tracking de aportes

**[FEAT-6] Ajuste por inflación ARS**

- Toggle "Valor real" en el dashboard: deflacta montos históricos ARS
- Porcentaje de inflación mensual configurable (o datos INDEC vía API)
- Métrica "pérdida real vs. inflación" en el período seleccionado
- Diferenciador clave para el mercado argentino

---

## Fase 5 — Funcionalidades avanzadas (AR/UY)

**Estado:** ⬜ Pendiente · **Versión:** — · **Fecha:** —

### Objetivo

Features específicas del contexto financiero argentino y uruguayo que hacen la app notablemente superior a alternativas genéricas.

### Items

**[FEAT-5.1] Ciclo de tarjeta de crédito**

- Entidad `CreditCard`: nombre, fecha de cierre de resumen, fecha de vencimiento
- Gastos se asocian a una tarjeta y quedan en el "resumen abierto" hasta su cierre
- Vista: total del resumen abierto actual + monto a debitar en el próximo vencimiento
- Permite planificar disponibilidad de fondos y evitar recargos por mora

**[FEAT-5.2] Seguimiento de deudas y cuotas**

- Entidad `Debt`: acreedor/deudor, monto total, pagado, restante, próxima cuota, fecha fin
- Track de compras en cuotas (patrón dominante en Argentina: 12/18 cuotas sin interés)
- Proyección del impacto en el flujo de caja de meses futuros
- Vista "Obligaciones mensuales" con el total comprometido cada mes

**[FEAT-5.3] Portfolio real de inversiones**

- Tipos específicos con campos propios:
  - **CEDEARs**: ticker, cantidad, precio promedio de compra, precio actual (API IOL/BYMA)
  - **Plazo Fijo**: banco, monto, TNA, fecha de vencimiento, interés acumulado, TEA calculada
  - **FCI**: fondo, cuotapartes, VCN diario, rendimiento desde suscripción
  - **Bonos**: ticker, cantidad, precio compra, precio mercado
  - **Cauciones**: monto, plazo, tasa
- Vista de portfolio con: posición por instrumento, P&L en ARS y USD, breakdown de asignación
- Dashboard de inversiones separado del tracker de movimientos

**[FEAT-5.4] Multi-cuenta**

- Entidad `Account`: nombre, tipo (efectivo/caja ahorro/corriente/inversión/digital), moneda, saldo inicial
- Cada transacción pertenece a una cuenta
- Transferencias entre cuentas como operación de primera clase (sin doble registro de ingreso/egreso)
- Cuentas típicas en Argentina: cuenta corriente, caja ahorro ARS, caja ahorro USD, Mercado Pago/Ualá/Naranja X, efectivo (colchón)
- Vista de patrimonio neto consolidado por cuenta y total

**[FEAT-5.5] Notificaciones y recordatorios**

- Recordatorios para: pagos próximos de tarjeta, cuotas a vencer, presupuesto al 80%, metas de ahorro
- Implementación: Service Worker + `self.registration.showNotification()`
- Scheduling local (no requiere servidor): `setInterval` en SW o Web Periodic Background Sync
- Permission request en onboarding

---

## Fase 6 — Infraestructura y escala

**Estado:** ⬜ Pendiente · **Versión:** — · **Fecha:** —

### Objetivo

Reemplazar la infraestructura mock y local-only con una solución real. Prerequisito para multi-dispositivo, retención a largo plazo y modelo de usuario sólido.

### Items

**[INFRA-1] Autenticación real (Supabase Auth)**

- Reemplazar mock de localStorage con Supabase Auth
- Providers: email/password + Google OAuth + Magic Link
- Sesión persistente multi-dispositivo
- Middleware de Next.js para proteger rutas
- Migración de datos locales existentes al cloud en primer login
- Stack: `@supabase/supabase-js` + `@supabase/ssr`

**[INFRA-2] Sincronización en la nube (Supabase Postgres)**

- Migrar todos los stores de Zustand a Supabase con Row Level Security
- Estrategia offline-first: Zustand como caché local, sync en background
- Resolución de conflictos: "last write wins" con timestamps
- Las tablas mapean directamente a los tipos TypeScript existentes

**[INFRA-3] Rutas API autenticadas**

- Reemplazar el secret compartido temporal (Fase 2) con middleware de sesión real
- Asociar llamadas a Gemini al usuario autenticado para auditoría de uso
- Rate limiting por usuario en las rutas de IA

**[INFRA-4] Configuración de producción**

- Variables de entorno en Vercel (GEMINI_API_KEY, Supabase keys)
- Dominio propio
- Analytics (Vercel Analytics o Plausible)
- Error monitoring (Sentry)
- PWA íconos generados en CI (script `sharp` en `postinstall`)
- `pnpm build --webpack` en CI para generar el service worker correctamente

---

## Registro de versiones

| Versión | Fecha      | Descripción                                                                                   |
| ------- | ---------- | --------------------------------------------------------------------------------------------- |
| v0.1.0  | 2026-05-30 | MVP inicial — dashboard, movimientos, inversiones, análisis IA, configuración, auth mock, PWA |
| v0.1.1  | 2026-05-30 | Pendientes Fase 0: íconos PWA PNG, hash de contraseñas, formatMoney negativos, validación Zod en store |

---

## Criterios de "completada" por fase

- **Fase 1:** Todos los bugs listados corregidos y con build limpio. `formatMoney` testeado manualmente con valores negativos. PWA instala correctamente en Android.
- **Fase 2:** Las rutas de IA no son accesibles sin el secret configurado. Upload rechaza archivos no-imagen y >10MB. Store mutations validan con Zod.
- **Fase 3:** La app puede exportar e importar datos sin pérdida. Las tasas del dólar blue se actualizan con un tap. El onboarding cubre el flujo completo de usuario nuevo.
- **Fase 4:** Un usuario puede registrar su sueldo quincenal como recurrente, ver un presupuesto mensual por categoría, y una meta de ahorro en USD con proyección de fecha.
- **Fase 5:** Un usuario argentino puede registrar su cartera de CEDEARs y Plazos Fijos con P&L real, sus cuotas pendientes, y recibir un recordatorio antes del cierre de tarjeta.
- **Fase 6:** Un usuario puede cerrar sesión, cambiar de dispositivo, iniciar sesión y ver todos sus datos sincronizados. La API de IA requiere sesión válida.

---

## Referencias

- **Revisión de código completa:** realizada el 2026-05-30 con agentes Opus via workflow multi-ángulo (40 candidatos analizados, 12 bugs confirmados)
- **Reporte de bugs completo:** ver salida del workflow `finanzas-full-review`
- **API tasas dólar:** `https://dolarapi.com/v1/dolares` (gratuita, sin auth)
- **Supabase docs:** `https://supabase.com/docs/guides/getting-started/quickstarts/nextjs`
- **Serwist PWA Next.js:** `https://serwist.pages.dev/docs/next`
