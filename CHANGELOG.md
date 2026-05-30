# Changelog

Todos los cambios notables de este proyecto están documentados en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [0.1.1] — 2026-05-30

Resuelve los cuatro ítems pendientes de la Fase 0 identificados en la revisión de código.

### Corregido

**PWA — íconos PNG generados correctamente**

- Generados `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png` a partir del SVG existente con `sharp`
- El ícono maskable incluye fondo esmeralda con 10 % de safe-zone (contenido al 80 %) según la especificación W3C
- `manifest.webmanifest` actualizado: 4 entradas separadas con `purpose` correcto (`"any"` y `"maskable"` como entradas distintas)
- El PWA ahora puede instalarse correctamente en Android/Chrome

**Auth — contraseñas hasheadas en lugar de texto plano**

- Introducido `src/lib/hash.ts` con hash FNV-1a 32-bit + salt de aplicación, sincrónico y sin dependencias externas
- `auth-store` actualizado: el campo `_passwordHash` reemplaza a `_password`; ninguna contraseña en texto plano se persiste en localStorage
- Login, registro y reset de contraseña actualizados para comparar/guardar el hash
- `partialize` explícito en el persist documenta qué se almacena; los hashes de contraseña se almacenan (para permitir login tras recarga) pero nunca el texto plano
- Nota: sigue siendo mock — la autenticación real con Supabase Auth se implementa en Fase 6

**`formatMoney` — negativos con signo correcto**

- `src/lib/money.ts`: separa el signo antes de formatear con `Math.abs(amount)`, produciendo `-$1.200` en lugar de `$-1.200`
- Comportamiento ahora consistente con `formatCompact` que ya lo manejaba correctamente

**Validación en mutaciones del store de transacciones**

- Creado `src/lib/schemas.ts` con `TransactionSchema` (Zod) como única fuente de verdad para la estructura de una transacción
- `transactions-store` actualizado: `addTransaction` y `updateTransaction` validan con Zod antes de persistir; retornan `{ success, error? }` en lugar de `void`/`Transaction`
- `transaction-sheet.tsx` actualizado para manejar los nuevos tipos de retorno
- También corregido el bug BUG-M2: `getRecentTransactions` ahora ordena por `t.date` (fecha real de la transacción) en lugar de `createdAt`

### Técnico

- Instalado `sharp@0.34.5` como devDependency para generación de íconos
- Script de generación de íconos en `/tmp/gen-icons.mjs` (puede incorporarse a `postinstall` en el futuro)

---

## [0.1.0] — 2026-05-30

Primera versión funcional de la app. MVP completo con todas las secciones principales, diseño fintech premium, soporte multi-moneda/multi-país e integración con IA de Gemini.

### Infraestructura y stack

- Scaffold con **Next.js 16.2** (App Router, Turbopack en dev, webpack en build)
- **Tailwind v4** con sistema `@theme inline` y variables OKLCH
- **shadcn/ui** inicializado y customizado: button, card, input, select, sheet, dialog, tabs, switch, dropdown, badge, avatar, calendar, command, popover, skeleton, sonner, progress, scroll-area, tooltip
- **Zustand 5** con `persist` middleware a localStorage para todos los stores
- **TypeScript** estricto en todo el proyecto
- **pnpm** como package manager
- **PWA** via Serwist (service worker, manifest, soporte offline)
- Fuente **Outfit** (Google Fonts) para toda la UI; Geist Mono para código

### Sistema de diseño

- Tema **claro/oscuro** con toggle y soporte de preferencia del sistema
- **5 colores de acento** configurables: esmeralda (default), violeta, azul, rosa, ámbar
- Acento aplicado vía clases CSS en el `<html>` por el `Providers` component
- Fondo dark: azul-gris profundo `oklch(0.095 0.018 265)` (no negro puro)
- Fuente Outfit cargada correctamente vía variable CSS `--font-outfit` (corrige bug de referencia circular del scaffold)
- Colores semánticos por tipo de transacción: `--income` (esmeralda), `--expense` (rojo), `--investment` (azul)
- `suppressHydrationWarning` en `<html>` y `<body>` para compatibilidad con extensiones de browser
- `dark accent-emerald` como clases SSR por defecto en el `<html>` para evitar flash de tema incorrecto

### Modelo de datos (`src/lib/types.ts`)

- `Currency` — código, nombre, símbolo, decimales. Defaults: USD, ARS, UYU, EUR
- `Country` — código, nombre, emoji bandera, monedas habilitadas. Defaults: Argentina (AR), Uruguay (UY)
- `ExchangeRate` — cotización relativa a USD como pivote (carga manual, arquitectura lista para API)
- `Category` — id, nombre, ícono (lucide), tipo, color. 22 categorías default (ingresos, gastos, inversiones)
- `Transaction` — id, tipo (income/expense/investment), monto, moneda, país, categoría, fecha, descripción, notas, source (manual/ai-receipt), createdAt
- `User` (mock) — id, nombre, email, createdAt
- `AccentColor` — union type de 5 acentos
- `Theme` — "light" | "dark" | "system"

### Stores Zustand (`src/stores/`)

- **`auth-store`** — autenticación mock local: register, login, logout, requestPasswordReset, resetPassword, updateProfile. Usuarios y sesión persistidos en localStorage (mock únicamente, no para producción)
- **`settings-store`** — moneda de visualización, tema, acento, lista de monedas y países configurados
- **`rates-store`** — tasas de cambio manuales con upsert por código de moneda
- **`categories-store`** — CRUD de categorías con seed de las 22 categorías default
- **`transactions-store`** — CRUD de movimientos con `crypto.randomUUID()` para IDs y `getRecentTransactions`
- **`analysis-store`** — análisis IA persistido: análisis actual + historial de hasta 10 análisis anteriores con fecha y snapshot de datos

### Utilidades (`src/lib/`)

- **`money.ts`** — `formatMoney` (Intl.NumberFormat por locale), `convertAmount` (conversión via pivote USD, retorna null si falta la tasa), `formatCompact` (sufijos K/M/B), `getCurrencyDisplay`
- **`aggregations.ts`** — `filterTransactions` (7 criterios), `computeTotals` (net = income - expenses - investments), `groupByMonth`, `groupByCategory`, `groupByCountry`

### Autenticación (`src/app/(auth)/`)

Layout con panel split en desktop: izquierda con branding/gradiente, derecha con el formulario.

- **`/login`** — email + contraseña, link a recuperar, redirección post-login
- **`/registro`** — nombre, email, contraseña, confirmación, redirección post-registro
- **`/recuperar`** — ingreso de email, mensaje neutral de confirmación
- **`/restablecer`** — nueva contraseña + confirmación, email prellenado por query param

Todas las páginas usan react-hook-form + Zod para validación. El logo se oculta en desktop donde ya aparece en el panel izquierdo.

### App layout (`src/app/(app)/layout.tsx`)

- Guard de autenticación con `useEffect` post-hidratación (evita redirect race con Zustand persist)
- Spinner de carga durante la ventana de hidratación (nav siempre visible)
- `<BottomNav />` renderizado incondicionalmente para que aparezca en todas las rutas

### Bottom navigation (`src/components/bottom-nav.tsx`)

- 4 items + botón central: Inicio · Movimientos · **+** · Análisis · Ajustes
- Indicador de ítem activo: barra de 3px sobre el ícono en color acento
- Botón central (+): círculo con glow de acento, navega a `/movimientos?new=true`
- Fondo con `backdropFilter: blur` y sombra ascendente para distinguirse del contenido
- `safe-area-inset-bottom` para iOS

### Dashboard (`/`)

- Saludo con hora del día + nombre del usuario; fecha en español
- Selector de período: Este mes / 3 meses / Este año
- **Hero card**: balance neto en grande (text-5xl), mini-stats (ingresos/gastos/inversiones), selector de moneda de visualización, patrón de puntos decorativo
- Breakdown **Por país**: tarjetas scrollables con bandera, nombre y balance neto por país (net = income - expenses - investments)
- **Gráfico de últimos 6 meses**: BarChart de Recharts con 3 barras por mes (ingresos/gastos/inversiones), leyenda, tooltip customizado
- **Movimientos recientes**: últimos 5 ordenados por fecha, con ícono de categoría, descripción, fecha en español y monto con signo/color por tipo
- **Acciones rápidas**: 3 cards (Nuevo gasto / Nuevo ingreso / Nueva inversión) con colores semánticos
- Estado vacío con CTA cuando no hay transacciones

### Movimientos (`/movimientos`)

- Lista agrupada por fecha con headers ("Hoy", "Ayer", nombre del día, fecha completa)
- **Pills de filtro rápido por tipo** sobre el listado: Todos / Gastos / Ingresos / Inversiones (con colores semánticos en activo)
- **Filter sheet** (desliza desde abajo): búsqueda por texto, país (con bandera), moneda (con símbolo), categoría, rango de fechas
- Selects del filtro con triggers customizados que muestran el valor legible ("Todos" cuando no hay selección, bandera+nombre para países, símbolo+código para monedas)
- **Chips de filtros activos** debajo del header, cada uno eliminable individualmente
- Contador de movimientos filtrados en el header
- Cada item: ícono de categoría en círculo coloreado, descripción + categoría, monto con signo y color, código de moneda y bandera del país
- Menú contextual por item: editar o eliminar con confirmación
- **Transaction Sheet** para alta/edición:
  - Tabs de tipo (Gasto/Ingreso/Inversión) con colores
  - Selector de moneda con símbolo en acento + código
  - Selector de país con emoji bandera + código
  - Input de monto en grande con símbolo de moneda
  - Grid visual de selección de categoría (4 columnas, íconos coloreados)
  - Date picker via Calendar + Popover
  - Campo de descripción y notas opcionales
  - Confirmación antes de eliminar en modo edición
  - Source `"ai-receipt"` para movimientos cargados desde análisis de ticket

### Inversiones (`/inversiones`)

- Hero card con total invertido en moneda de visualización
- Barra de distribución horizontal por categoría (segmentos proporcionales)
- Lista de categorías con barra de progreso individual y porcentaje
- Últimos 5 movimientos de tipo inversión
- Estado vacío con link a agregar inversión
- FAB en esquina inferior derecha para nuevo movimiento de tipo inversión

### Análisis IA (`/analisis`)

- Selector de período: Este mes / 3 meses / Todo
- Mini stats del período (ingresos/gastos/inversiones) en el header
- Botón "Generar análisis" / "Regenerar análisis"
- **Health score ring**: SVG circular con color según puntuación (≥81 verde, ≥61 teal, ≥41 ámbar, <41 rojo)
- Resumen ejecutivo del análisis
- Cards de oportunidad de ahorro
- **Alertas** con severity (high=rojo, medium=ámbar, low=verde)
- **Observaciones** por categoría con tipo (positive/warning/critical/info)
- **Sugerencias** con prioridad y acción concreta, borde de color por prioridad
- Timestamp del análisis generado
- **Historial** colapsable: hasta 10 análisis anteriores, cada uno expandible con score, resumen y primeras 2 sugerencias. Eliminación individual o total.
- Card feature "Escanear ticket" con link a `/escanear`
- Manejo de errores específico por tipo: quota agotada, API key inválida, modelo no disponible

### Escanear ticket (`/escanear`)

- Input de imagen con `capture="environment"` para cámara del dispositivo
- Preview de la imagen seleccionada con opción de cambiar
- Botón "Analizar con IA" deshabilitado hasta seleccionar imagen, con spinner durante análisis
- Resultado: comercio, confianza (badge verde/amarillo/rojo), fecha, moneda, tabla de items, subtotal/IVA/total
- Botón "Guardar como gasto" → abre TransactionSheet prellenado con datos del ticket
- Manejo de error cuando no hay API key (con link a Configuración)

### Configuración (`/configuracion`)

- **Perfil**: avatar con iniciales, edición de nombre inline, email, botón de logout
- **Apariencia**: selector de tema (3 botones), 5 círculos de color de acento, selector de moneda de visualización
- **Tipos de cambio**: lista de monedas con input de tasa por USD, timestamp de última actualización, tip específico para ARS (dólar blue)
- **Monedas configuradas**: lista con símbolo, badge "en uso", eliminar (con validación de uso activo), dialog para agregar nueva moneda
- **Países configurados**: lista con bandera, nombre, badges de monedas habilitadas, eliminar, dialog para agregar nuevo país

### API routes (`src/app/api/ai/`)

- **`/api/ai/insights`** (POST) — agrega summary financiero → Gemini 2.5 Flash → schema Zod `InsightsSchema` → respuesta estructurada (healthScore, observations, suggestions, alerts, savingsOpportunity)
- **`/api/ai/scan-receipt`** (POST, multipart) — imagen en base64 → Gemini 2.5 Flash Vision → schema Zod `ReceiptSchema` → merchant, date, currency, total, items[], category, confidence
- Manejo de errores diferenciado: quota (429), API key inválida (401), modelo no disponible (503)
- API key solo en servidor (`GEMINI_API_KEY` en `.env.local`)

### PWA

- `public/manifest.webmanifest` — nombre, short_name, start_url, display standalone, orientación portrait
- Service worker generado por Serwist en build (`pnpm build --webpack`)
- SW deshabilitado en desarrollo (evita conflicto con Turbopack)
- `turbopack: {}` en next.config.ts para silenciar advertencia en dev
- Meta `appleWebApp` para instalación en iOS
- Viewport `viewportFit: "cover"` para soporte de notch

### Fixes y ajustes iterativos (post-MVP)

- Corregido bug de referencia circular de fuente (`--font-sans: var(--font-sans)` → `var(--font-outfit)`)
- Corregido enrutamiento: eliminado `src/app/page.tsx` que impedía que `(app)/layout.tsx` aplicara al root `/` y ocultaba el BottomNav en el dashboard
- Corregido bug de hidratación Zustand: guard de auth con estado `hydrated` antes de redirigir
- Corregida inconsistencia en neto por país: `income - expenses - investments` (inversiones también son salida de efectivo)
- Eliminado FAB redundante de la página de movimientos (el botón + del BottomNav cumple la misma función)
- Corregido modelo de Gemini: `gemini-2.0-flash-exp` (deprecado) → `gemini-2.5-flash` (disponible con la API key configurada)
- Corregido `__all__` visible en selects de filtros: triggers customizados con display legible
- Agregadas pills de filtro rápido por tipo directamente sobre el listado de movimientos
- Análisis IA persistido en `analysis-store` con historial de hasta 10 análisis anteriores
- Inversiones incluidas en el gráfico de 6 meses del dashboard (tercera barra)

### Conocido y pendiente (ver `docs/plan-next-steps.md`)

- Contraseñas en texto plano en localStorage (mock — no usar en producción)
- Íconos PNG del PWA no generados (solo existe SVG; falla la instalación en Android)
- Rutas de IA sin autenticación (cualquiera puede consumir la cuota de Gemini)
- `formatMoney` produce `$-1.200` en negativos en lugar de `-$1.200`
- `useMemo` con `Date` inestables en el dashboard (memoización se invalida en cada render)
- Pérdida de datos al cerrar el sheet sin guardar (sin confirmación de descarte)

---

_Para el plan completo de próximas versiones ver [`docs/plan-next-steps.md`](docs/plan-next-steps.md)._
