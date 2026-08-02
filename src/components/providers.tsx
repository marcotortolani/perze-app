"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingGate } from "@/components/onboarding-gate";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { DbOwnerSync } from "@/components/db-owner-sync";
import { PinGate } from "@/components/pin-gate";
import { useSyncLoop } from "@/lib/offline/use-sync-loop";
import { useRealtimeSync } from "@/lib/offline/use-realtime-sync";

/**
 * Todo el estado de dominio (cuentas, movimientos, household…) vive en Dexie
 * y se lee/escribe a través de `lib/repos/*` detrás de TanStack Query — no
 * hay datos que prefetchear desde el servidor todavía (local-first, ver
 * docs/perze-plan-redesign-first-5-blocks.md). Por eso un solo QueryClient
 * de cliente alcanza: nada de la variante server/browser de las guías de
 * SSR de TanStack Query, que resuelve un problema que acá no existe.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (failureCount, error) => {
          // Sin red: no tiene sentido reintentar contra un servidor que no
          // existe hoy. Cuando se conecte Supabase, esto vuelve a un backoff normal.
          if (error instanceof Error && error.message === "offline") return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
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
