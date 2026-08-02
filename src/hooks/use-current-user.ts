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
 *
 * Fase 6 del plan de fluidez de navegación — antes esto resolvía con
 * `getUser()`, que pega contra el Auth server en CADA arranque en frío de
 * la PWA: `OnboardingGate` retiene el render entero (`ZMark` girando)
 * hasta que esto resuelve, así que ese round-trip era, en los hechos, el
 * primer paint de la app. `getSession()` lee la sesión ya guardada en el
 * storage local (cookies vía `@supabase/ssr`) sin red salvo que el access
 * token esté por vencer — se usa para resolver el tri-estado al toque, y
 * `getUser()` corre en paralelo, sin bloquear, para confirmar contra el
 * servidor: si discrepan (sesión revocada en otro dispositivo, token que
 * ya no vale), se corrige el cache y el gate reacciona igual que siempre.
 * El aviso de seguridad de Supabase sobre no confiar en `getSession()`
 * aplica a decisiones de autorización — acá es solo la señal de "pinta el
 * shell o no"; la barrera real sigue siendo RLS server-side en cada query.
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
        data: { session },
      } = await supabase.auth.getSession();
      const optimisticId = session?.user?.id ?? null;

      void supabase.auth.getUser().then(({ data: { user }, error }) => {
        const confirmedId = error ? null : (user?.id ?? null);
        if (confirmedId !== optimisticId) {
          queryClient.setQueryData(currentUserKey, confirmedId);
        }
      });

      return optimisticId;
    },
    staleTime: Infinity,
  });

  return data;
}

/**
 * Email de sesión — dato de identificación real (`auth.users.email`), no
 * vive en `profiles` y por eso no pasa por `profilesRepo`. Perfil (K2) lo
 * muestra de solo lectura: cambiar el email de auth no es un simple update,
 * requiere confirmación, y queda fuera de alcance de esta versión.
 */
export function useCurrentUserEmail(): string | null | undefined {
  const { data } = useQuery({
    queryKey: ["auth", "user", "email"],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.email ?? null;
    },
    staleTime: Infinity,
  });

  return data;
}
