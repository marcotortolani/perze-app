"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { DEMO_USER_ID } from "@/lib/demo-user";

export const currentUserKey = ["auth", "user"] as const;

/**
 * `auth.uid()` del lado del cliente (C7). Cae a `DEMO_USER_ID` cuando no
 * hay sesión — el camino "Probar con datos de ejemplo" de A2 nunca pasa
 * por login real y sigue funcionando 100% local, sin intentar sincronizar
 * (esas escrituras jamás van a coincidir con un `auth.uid()` real, a
 * propósito: es una demo, no se espera que sincronice).
 */
export function useCurrentUserId(): string {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: currentUserKey });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: currentUserKey,
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    staleTime: Infinity,
  });

  return data ?? DEMO_USER_ID;
}
