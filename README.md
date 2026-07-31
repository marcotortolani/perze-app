# PERZE — Paquete de diseño y desarrollo

App PWA de finanzas personales: multi-cuenta, multi-moneda, multi-país, con grupo familiar y módulo opcional de inversiones. Minimalista, mobile-first, offline-first.

## Los archivos, en orden de uso

| #   | Archivo                         | Qué es                                                                                                                                                            | Cuándo lo usás                                                  |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 00  | `00-producto.md`                | Análisis de producto: features, módulos, indicadores, gráficos, roadmap, riesgos                                                                                  | Léelo una vez. Es la fuente de verdad de _qué_ se construye.    |
| 01  | `01-arquitectura-datos.md`      | Stack, schema completo de Supabase, RLS, estrategia FX y offline, APIs de datos                                                                                   | Antes de escribir la primera migración                          |
| 02  | `02-design-system.md`           | Tokens, paleta validada, tipografía, motion, componentes, reglas de gráficos                                                                                      | Input obligatorio de los prompts de alta fidelidad y del código |
| 03  | `03-prompts-wireframes.md`      | 13 prompts: contexto maestro, mapa de flujos, 10 bloques de pantallas (W1–W10), auditoría                                                                         | Fase 1 de diseño                                                |
| 04  | `04-prompts-ui.md`              | 14 prompts: design system visual, componentes, motion, 10 bloques de alta fidelidad (D3–D12), auditoría. Incluye la tabla de mapeo W↔D — los números no coinciden | Fase 2 de diseño                                                |
| 05  | `05-prompts-desarrollo.md`      | `CLAUDE.md` del proyecto + prompts de implementación por bloque + auditoría final                                                                                 | Fase 3                                                          |
| 06  | `06-prompts-diseno-restante.md` | Los 8 prompts de los bloques F a L, la consolidación de biblioteca y la auditoría visual                                                                          | Fase 2 — ya ejecutado                                           |
| 07  | `07-handoff-a-claude-code.md`   | Cómo se le entrega todo esto a Claude Code: layout del repo, orden corregido, gates y la sesión de reconciliación                                                 | Antes de la primera línea de código                             |
| —   | `CLAUDE.md`                     | **Va en la raíz del repo.** Memoria de proyecto: decisiones cerradas y orden de autoridad entre documentos                                                        | Se lee en cada sesión                                           |
| —   | `contrato-componentes.md`       | La biblioteca: props, estados, tokens y accesibilidad de cada componente. Manda sobre la API de toda pieza                                                        | Fase 3                                                          |
| —   | `auditoria-visual.md`           | 49 defectos ordenados por costo de arreglarlos después. Corrige al diseño y al contrato                                                                           | Antes de programar pantallas                                    |
| —   | `marca/`                        | Sistema de marca: logotipo, ícono, favicon, splash, y los assets ya generados para el repo                                                                        | Antes del primer deploy                                         |

## Estado

**Los once bloques están diseñados y auditados**, con contrato de componentes y auditoría visual publicados. Lo que sigue es código: empezá por `07`.

**Cinco defectos hay que resolver antes de programar pantallas.** Cuatro caen en las fases de tokens y biblioteca (C4 y C6); uno —cuatro pantallas sin diseñar y cinco vistas huérfanas— vuelve a Claude Design. Está todo en `07` § 2.

## El camino

```
00 + 01 (leer)
   ↓
PROMPT 0  ──► PROMPT W0 (mapa y flujos) ──► W1…W10 ──► WV (auditoría)
   ↓
PROMPT D0 (estilo) ──► D1 (componentes) ──► D2 (motion) ──► D3…D12 ──► DV
   ↓
CLAUDE.md ──► C1…C8 (fundaciones + captura) ──► C9…C20 ──► CQ
```

**No saltees `W0` ni `WV`.** El mapa de flujos es el contrato que hace que el sistema sea un sistema y no una colección. La auditoría es donde encontrás barato lo que después sale caro.

Conteo por bloque: A=11 · B=8 · C=11 · D=7 · E=7 · F=7 · G=6 · H=14 · I=12 · J=10 · K=13 · L=6 = 112 items. Pero **112 no son 112 pantallas**: el bloque L son sistemas que viven dentro de otras vistas, y varios items son estados y no rutas. **Vistas navegables reales: 82** (más 26 variantes de estado y 6 sistemas transversales).

### Decisiones cerradas (no volver a abrirlas sin motivo nuevo)

| Tema                      | Decisión                                                                                                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progresividad             | Por **flags ortogonales** (monedas>1, miembros>1, módulos activos), no por "perfil". No existe un campo perfil.                                                                                                                                                                                           |
| Grupo familiar            | **Módulo**, no núcleo                                                                                                                                                                                                                                                                                     |
| Bloqueo por PIN           | **Opcional y apagado por defecto**. Encendido, la captura queda pre-auth: escribir no pide PIN, leer sí                                                                                                                                                                                                   |
| Sin cotización disponible | El movimiento **se guarda igual**, sin conversión: `fx_rate` y `amount_base` en `NULL`, `fx_source = 'pending'`. Nunca rate = 1 inventado, nunca bloquear el guardado. El 1 legítimo (moneda del movimiento = moneda base) va con `fx_source = 'identity'`: distinguirlos es para lo que existe ese campo |
| Métrica de captura        | **< 5 segundos y 3 decisiones.** "3 taps" es el proxy del camino feliz, no la meta                                                                                                                                                                                                                        |
| Instalar la PWA           | **Después** del primer gasto, nunca antes                                                                                                                                                                                                                                                                 |
| Flujos críticos           | Son **10**, no 8: se suman importar desde otra app y conflicto de sync entre miembros                                                                                                                                                                                                                     |
| Cuarto slot del tab bar   | Lo **elige el usuario** (default Análisis). La app nunca reconfigura la navegación sola                                                                                                                                                                                                                   |
| Apagar un módulo          | **Oculta, nunca borra.** Las cuotas en curso siguen descontando: ya son movimientos reales                                                                                                                                                                                                                |
| Qué cuenta como "vista"   | Ruta propia + alcanzable por deep link. Los estados no cuentan                                                                                                                                                                                                                                            |

## Antes de arrancar

1. **El nombre es PERZE** y el logotipo está resuelto: el nombre con la Z en violeta, sin símbolo al lado. La Z tiene dos cortes ópticos —display para el ícono y favicon, texto para dentro de la palabra— y los assets están generados en `marca/`.
2. **Decidí la licencia** (MIT si querés máxima adopción, AGPL si te importa que nadie lo cierre y lo venda).
3. Fase 1 solo resuelve estructura y flujo. Si en wireframe estás discutiendo colores, perdiste el foco.

## Los cuatro criterios que gobiernan todo

1. **< 5 segundos y 3 decisiones** para cargar un gasto. Todo lo demás se subordina. ("3 taps" es el proxy del camino feliz, no la meta: los dígitos del monto no se pueden evitar.)
2. **Minimalismo**: más pantallas, menos por pantalla. Presupuesto por pantalla: 1 cifra héroe · 1 color de marca fuera de los gráficos · 1 acción primaria · 3 niveles tipográficos · 5 elementos interactivos sobre el pliegue · 0 bordes de caja evitables · 0 iconos decorativos.
3. **~90% neutros.** Color solo cuando significa algo.
4. **Progresividad**: el modelo de datos es completo desde el día 1; la UI se revela según **flags** (monedas en uso, miembros, módulos activos), no según un "perfil" que no existe en el producto.

## Módulos opcionales — lista canónica

Son **seis**, y esta lista es la que vive en `households.enabled_modules`:

`budgets` · `goals` · `recurring` · `debts` · `investments` · `family`

Análisis **no** es un módulo: es un tab fijo cuyo contenido varía según qué módulos estén encendidos y cuántos datos haya.

## Sobre la paleta

Neutros cálidos + violeta índigo (marca) + aqua (positivo) + naranja (atención) + 4 colores de estado reservados. La paleta de datos de 5 slots está **validada programáticamente** contra las superficies reales de la app, en claro y oscuro: banda de luminosidad, croma, separación para daltonismo, piso de visión normal y contraste. Todos los checks pasan.

Deliberadamente **no** se usa verde/rojo para ingreso/gasto: es la convención más común y la peor para daltonismo (ΔE 6.5, en banda de advertencia). El par aqua/naranja pasa con ΔE 8.7–9.6.

## Fuentes de datos externas

| Uso                                          | Fuente                                        | Key       |
| -------------------------------------------- | --------------------------------------------- | --------- |
| Cotizaciones LatAm (oficial, blue, MEP, CCL) | [DolarApi](https://dolarapi.com/docs/)        | No        |
| FX internacional e histórico                 | [Frankfurter](https://frankfurter.dev/)       | No        |
| Inflación, UVA, plazo fijo AR                | [ArgentinaDatos](https://argentinadatos.com/) | No        |
| Acciones AR, CEDEARs, bonos, ONs             | [Data912](https://data912.apidocs.ar/)        | No        |
| Crypto                                       | CoinGecko                                     | Free tier |
| Acciones internacionales                     | Finnhub / Twelve Data                         | Free tier |

Ninguna está en el camino crítico: todo se cachea en la base y siempre se puede cargar el valor a mano.
