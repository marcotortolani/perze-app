#!/usr/bin/env bash
# F4 (auditoría técnica) — no existe `supabase db reset` en este proyecto
# (sin Docker, ver CLAUDE.md § Stack): esto es el equivalente para el
# proyecto remoto de desarrollo. Borra el esquema `public` completo y
# reaplica la cadena de migraciones desde cero — la única prueba honesta
# de "la cadena aplica desde cero en un proyecto vacío" (A2).
#
# DESTRUCTIVO. Corre solo contra el proyecto de DESARROLLO linkeado
# (`supabase link`), nunca contra producción. Requiere estar autenticado
# (`supabase login`) y tener el proyecto linkeado.
#
# Uso: ./scripts/db-reset.sh
set -euo pipefail

read -r -p "Esto borra TODO el esquema public del proyecto linkeado. Escribí 'reset' para confirmar: " confirm
if [[ "$confirm" != "reset" ]]; then
  echo "Cancelado."
  exit 1
fi

echo "==> Recreando el esquema public (DROP CASCADE + CREATE)..."
supabase db query --linked "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
"

echo "==> Reaplicando la cadena completa de migraciones..."
supabase db push --linked --yes

echo "==> Corriendo GATE-1 (pgTAP) contra el esquema recién creado..."
supabase db query --linked -f supabase/tests/database/00_setup.sql > /dev/null
for f in supabase/tests/database/1*_*.sql supabase/tests/database/2*_*.sql; do
  echo "--- ${f} ---"
  supabase db query --linked -f "${f}"
done

echo "==> Listo. Revisá arriba que no haya ninguna línea 'not ok'."
echo "    Nota: los GRANT de los roles (anon/authenticated/service_role) sobre el"
echo "    esquema se verifican arriba a mano — es el punto donde esto se rompe"
echo "    después de recrear el esquema (CLAUDE.md § Stack)."
