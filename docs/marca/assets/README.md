# PERZE — assets de marca

El logotipo es el nombre con la Z en violeta — no hay símbolo al lado. La Z tiene **dos cortes ópticos de la misma construcción**:

- **display** (ícono, favicon, loader) — cuadrada y pesada, aguanta 16 px sola
  `M9 9H39V16L20 32H39V39H9V32L28 16H9Z` sobre grilla de 48
- **texto** (dentro de la palabra) — ancho 0.80 de la altura, barra 0.18; convive con la P, la E y la R sin sobresalir

Nunca se cruzan: el corte de display no entra en la palabra y el de texto no va solo.

Los `.svg` son las fuentes. Los `.png` se regeneran con `node build-assets.mjs` (en la carpeta padre) — no los edites a mano.

## Qué es cada archivo

| Archivo | Uso |
|---|---|
| `mark.svg` | La Z sola, `currentColor`. Es la fuente de todo lo demás. |
| `icon.svg` | Favicon. Trae `prefers-color-scheme` adentro: violeta oscuro en pestaña clara, violeta claro en pestaña oscura. Trazo un poco más grueso que `mark.svg` para aguantar 16 px. |
| `icon-mono.svg` | Silueta blanca sobre transparente. Ícono de notificación de Android (24 dp). |
| `app-icon-any.svg` | Baldosa `#131315` + Z `#8B7CF6` al 55% del lienzo. |
| `app-icon-maskable.svg` | Igual pero al 41%, dentro del círculo de zona segura de Android. |
| `app-icon-mono.svg` | Capa monocromática para íconos temáticos de Android 13+. |
| `wordmark-dark.svg` · `-light.svg` | **El logotipo.** Nombre completo con la Z violeta, ya en curvas: no depende de que Geist esté instalada. |
| `wordmark-mono-dark.svg` · `-light.svg` | Un solo color, para impresión, sellos, watermarks y fondos de foto. |
| `favicon.ico` | 48 · 32 · 16 en un archivo, para navegadores viejos y la barra de favoritos. |
| `opengraph-image.png` | 1200×630, preview al compartir el link. |
| `og-square.png` | 1200×1200, porque WhatsApp recorta el 1200×630 al centro. |

## Dónde va cada cosa en Next.js 16

```
app/
  icon.svg              ← copiá icon.svg
  favicon.ico           ← copiá favicon.ico
  apple-icon.png        ← copiá apple-icon.png (180×180)
  opengraph-image.png   ← copiá opengraph-image.png
public/
  icons/                ← icon-192, icon-512, icon-maskable-*, icon-mono-512
```

## manifest.webmanifest

```json
{
  "name": "PERZE",
  "short_name": "PERZE",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0A0B",
  "theme_color": "#0A0A0B",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-mono-512.png", "sizes": "512x512", "type": "image/png", "purpose": "monochrome" }
  ],
  "shortcuts": [
    { "name": "Cargar un gasto", "url": "/capturar", "icons": [{ "src": "/icons/shortcut-gasto.png", "sizes": "96x96" }] }
  ]
}
```

`purpose: "any"` y `purpose: "maskable"` son **archivos distintos**. Declarar el mismo PNG en los dos hace que Android recorte la Z.

## Lo que todavía falta

- `shortcut-gasto.png` y `shortcut-movimientos.png` (96×96) — dependen de qué íconos de acción queden en el set final.
- `apple-splash-*.png` — el splash de iOS son ~15 pares claro/oscuro, uno por resolución. Conviene generarlos en el build, no versionarlos.
- Los cinco íconos de interfaz que faltan: `mail`, `lock`, `fingerprint`, `install`, `flag/globe`.
- Un ícono propio para **cuenta corriente**: hoy comparte `bank` con caja de ahorro y las dos se ven iguales.

## Reglas de uso

- El logotipo **no aparece dentro de la app**. Vive en el splash, el README, "acerca de" y la preview al compartir. El único violeta de cada pantalla lo ocupa la acción primaria.
- Piso del logotipo a color: **14 px de altura de mayúscula**. Más chico, va el monocromático o el símbolo solo.
- No existe lockup horizontal ni vertical con el símbolo al lado del nombre: decía la Z dos veces.
