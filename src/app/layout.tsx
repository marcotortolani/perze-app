import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { IntlBoundary } from "@/components/intl-boundary";
import { Providers } from "@/components/providers";
import { getThemeInitScript } from "@/lib/theme/init-script";
import { APP_VERSION } from "@/lib/version";
import { env } from "@/env";
import "./globals.css";

/**
 * Splash screens de iOS (`apple-touch-startup-image`): Safari no genera uno
 * a partir del ícono como Android, así que sin esto instalar la PWA muestra
 * blanco/negro liso hasta que carga el JS. Tabla de dispositivos en píxeles
 * CSS (no de dispositivo) — ver `scripts/generate-splash-screens.mjs` para
 * cómo se generaron los PNG y cómo regenerarlos si cambia el logo.
 */
const SPLASH_DEVICES: Array<{ name: string; width: number; height: number; ratio: number }> = [
  { name: "iphone-se", width: 375, height: 667, ratio: 2 },
  { name: "iphone-8-plus", width: 414, height: 736, ratio: 3 },
  { name: "iphone-x", width: 375, height: 812, ratio: 3 },
  { name: "iphone-xr", width: 414, height: 896, ratio: 2 },
  { name: "iphone-xs-max", width: 414, height: 896, ratio: 3 },
  { name: "iphone-12", width: 390, height: 844, ratio: 3 },
  { name: "iphone-12-pro-max", width: 428, height: 926, ratio: 3 },
  { name: "iphone-14-pro", width: 393, height: 852, ratio: 3 },
  { name: "iphone-14-pro-max", width: 430, height: 932, ratio: 3 },
  { name: "ipad-9-7", width: 768, height: 1024, ratio: 2 },
  { name: "ipad-pro-10-5", width: 834, height: 1112, ratio: 2 },
  { name: "ipad-pro-11", width: 834, height: 1194, ratio: 2 },
  { name: "ipad-air-10-9", width: 820, height: 1180, ratio: 2 },
  { name: "ipad-pro-12-9", width: 1024, height: 1366, ratio: 2 },
];

function splashMediaQuery(device: (typeof SPLASH_DEVICES)[number], scheme: "light" | "dark"): string {
  return `(prefers-color-scheme: ${scheme}) and (device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: portrait)`;
}

const APPLE_STARTUP_IMAGES = SPLASH_DEVICES.flatMap((device) => [
  { url: `/splash/${device.name}-dark.png`, media: splashMediaQuery(device, "dark") },
  { url: `/splash/${device.name}-light.png`, media: splashMediaQuery(device, "light") },
]);

/**
 * Async (no `const metadata` estático) para traducir `description` según
 * el locale de la cookie — misma lectura dinámica que `IntlBoundary`, ver
 * su comentario. Next transmite metadata por separado del body, así que
 * esto no necesita su propio `<Suspense>`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    // Sin esto Next resuelve `opengraph-image.png` contra `localhost:3000`
    // incluso en producción — el preview al compartir el link queda roto.
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: "PERZE",
    description: t("app.description"),
    // Única fuente de verdad: `package.json` vía `lib/version.ts` — se lee de
    // vuelta en el footer de "Más" (`(app)/mas/page.tsx`) para que no haga
    // falta actualizar dos lugares en cada bump de versión.
    generator: `PERZE v${APP_VERSION}`,
    other: { "app-version": APP_VERSION },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "PERZE",
      startupImage: APPLE_STARTUP_IMAGES,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Los dos colores son `--page` en dark y light (ver src/app/globals.css).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="es" es el fallback estático (idioma fuente); `IntlBoundary` lo
    // corrige en cliente para EN/PT — ver `src/components/sync-html-lang.tsx`.
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Anti-flash: setea `.light` antes del primer paint si corresponde. */}
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <Suspense fallback={null}>
          <IntlBoundary>
            <Providers>{children}</Providers>
          </IntlBoundary>
        </Suspense>
      </body>
    </html>
  );
}
