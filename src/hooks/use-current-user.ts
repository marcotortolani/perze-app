"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export const currentUserKey = ["auth", "user"] as const;

/**
 * `auth.uid()` del lado del cliente (C7). Tri-estado — B3 de la auditoría
 * técnica: antes caía a `DEMO_USER_ID` tanto mientras la consulta estaba
 * "cargando" (primer render post-refresh) como cuando de verdad no había
 * sesión, sin forma de distinguir los dos casos. Cualquier escritura hecha
 * en esa ventana quedaba con `created_by` = id demo, se encolaba, y
 * fallaba por RLS para siempre (`created_by = auth.uid()`) — exactamente
 * la ventana del caso de uso optimizado del producto (shortcut → tipear en
 * menos de 5s).
 *
 * `undefined` = todavía no se sabe (la query no resolvió). `null` = se
 * sabe que no hay sesión. Todo llamador que escribe tiene que bloquear o
 * diferir mientras no haya un `string` real — `DEMO_USER_ID` queda
 * reservado exclusivamente al household sembrado por `seedDemoHousehold()`
 * (que no pasa por este hook).
 */
export function useCurrentUserId(): string | null | undefined {
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

  return data;
}
