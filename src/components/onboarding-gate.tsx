"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentHousehold } from "@/hooks/use-current-household";

const EXEMPT_PREFIXES = ["/onboarding", "/dev", "/api", "/offline"];

/**
 * Gate del Bloque A: sin household, cualquier ruta de la app real redirige a
 * `/onboarding` — reemplaza el auto-seed de demo que vivía en
 * `useCurrentHousehold` antes de que este bloque existiera.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: household, isLoading } = useCurrentHousehold();
  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!exempt && !isLoading && household === null) router.replace("/onboarding");
  }, [exempt, isLoading, household, router]);

  if (!exempt && !isLoading && household === null) return null;
  return <>{children}</>;
}
