#!/usr/bin/env bash
#
# Corre un archivo .sql contra la base de Campos HR, por la API de gestión de
# Supabase.
#
#   bash scripts/supabase-sql.sh supabase/renombrar-campos-como-airtable.sql
#
# Existe para que los cambios de esquema queden en un archivo versionado y no
# pegados a mano en el editor web: así se ve en el historial qué se corrió y
# cuándo. Los DDL de esta base viven en `supabase/`.
#
# De dónde salen las credenciales, ninguna de las dos versionada:
#   - el proyecto, de SUPABASE_URL en .env.local
#   - el token de gestión, de ~/.supabase-pat
#
# El alcance es una sola cosa: mandar el SQL de ese archivo a ese proyecto.

set -euo pipefail

archivo="${1:-}"
if [[ -z "$archivo" ]]; then
  echo "Falta el archivo .sql. Uso: bash scripts/supabase-sql.sh <archivo.sql>" >&2
  exit 1
fi
if [[ ! -f "$archivo" ]]; then
  echo "No existe el archivo: $archivo" >&2
  exit 1
fi
if [[ ! -f "$HOME/.supabase-pat" ]]; then
  echo "Falta ~/.supabase-pat, el token de la API de gestión." >&2
  exit 1
fi
if [[ ! -f .env.local ]]; then
  echo "Falta .env.local, de donde sale SUPABASE_URL." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.local; set +a

proyecto="$(printf '%s' "$SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#')"
token="$(cat "$HOME/.supabase-pat")"

# El cuerpo se arma con python y no a mano: un SQL con comillas o saltos de
# línea rompe cualquier JSON escrito con echo.
cuerpo="$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$archivo")"

echo "Corriendo $archivo contra el proyecto $proyecto"

respuesta="$(curl -sS -X POST \
  "https://api.supabase.com/v1/projects/$proyecto/database/query" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  --data-binary "$cuerpo")"

echo "$respuesta"

# La API contesta 200 con un cuerpo de error adentro, así que el código de
# salida de curl no alcanza para saber si salió bien.
if printf '%s' "$respuesta" | grep -q '"message"'; then
  echo "El SQL no se aplicó." >&2
  exit 1
fi

echo "Listo."
