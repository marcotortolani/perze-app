"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingGate } from "@/components/onboarding-gate";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { DbOwnerSync } from "@/components/db-owner-sync";
import { PinGate } from "@/components/pin-gate";
import { PwaInstallListener } from "@/components/pwa-install-listener";
import { useSyncLoop } from "@/lib/offline/use-sync-loop";
import { useRealtimeSync } from "@/lib/offline/use-realtime-sync";

/**
 * Todo el estado de dominio (cuentas, movimientos, household…) vive en Dexie
 * y se lee/escribe a través de `lib/repos/*` detrás de TanStack Query — no
 * hay datos que prefetchear desde el servidor todavía (local-first, ver
 * docs/perze-plan-redesign-first-5-blocks.md). Por eso un solo QueryClient
 * de cliente alcanza: nada de la variante server/browser de las guías de
 * SSR de TanStack Query, que resuelve un problema que acá no existe.
 *
 * Fase 3 del plan de fluidez de navegación — `staleTime`/`gcTime` estaban
 * pensados para datos remotos (30s de fresco, 5 min de `gcTime` por
 * default): volver a un tab después de esa ventana mostraba el skeleton de
 * vuelta aunque Dexie tuviera los datos ahí mismo. Acá la fuente de verdad
 * es local y toda escritura ya invalida lo que corresponde vía
 * `createOptimisticMutation()`, y el sync loop invalida lo que el pull
 * remoto haya tocado (`invalidate-after-pull.ts`) — nada se vuelve
 * silenciosamente obsoleto por quedarse quieto. `refetchOnMount`/
 * `refetchOnReconnect` en `false` por el mismo motivo: un mount o una
 * reconexión no son señal de que Dexie cambió, y la invalidación explícita
 * ya cubre los casos en que sí cambió.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (failureCount, error) => {
          // Sin red: no tiene sentido reintentar contra un servidor que no
          // existe hoy. Cuando se conecte Supabase, esto vuelve a un backoff normal.
          if (error instanceof Error && error.message === "offline") return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
    },
  });
}

function SyncLoop() {
  useSyncLoop();
  // F3 (`docs/plan-sync-incremental.md` § 6) — atajo de latencia sobre el
  // pull de 30s de arriba, nunca un camino propio: ver la nota en
  // `use-realtime-sync.ts`.
  useRealtimeSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ServiceWorkerRegister />
      <PwaInstallListener />
      <DbOwnerSync />
      <SyncLoop />
      <PinGate>
        <OnboardingGate>{children}</OnboardingGate>
      </PinGate>
      <Toaster richColors position="top-center" />
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
