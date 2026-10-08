#!/usr/bin/env bash
# Recarga los datos de demostracion en una base de DESARROLLO (ecopac-dev o el stack local).
#
#   1. Vacia los datos de negocio y conserva cuentas y catalogos
#      (recargar-datos-demo/vaciar-datos-de-negocio.sql).
#   2. Corre supabase/seed-demo.sql.
#   3. Deja la cuenta de administradora con el correo y la contrasena que se le pasan.
#
# Todo en una sola transaccion: si algo falla, la base queda como estaba.
#
# Variables de entorno (ninguna vive en el repositorio):
#   ECOPAC_DB_URL             Cadena de conexion de la base (Project Settings > Database).
#   ECOPAC_ADMIN_CORREO       Correo de la cuenta de administradora.
#   ECOPAC_ADMIN_CLAVE        Su contrasena.
#   ECOPAC_CONFIRMAR_VACIADO  Tiene que ser "si": el paso 1 borra datos y no se deshace.
#   ECOPAC_REF_PRODUCCION     Opcional. Si la cadena de conexion lo contiene, el script se niega.
#
# NUNCA contra ecopac-prod: seed-demo.sql es de desarrollo (docs/DATOS-DEMO.md).

set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/.." && pwd)"

: "${ECOPAC_DB_URL:?Falta ECOPAC_DB_URL}"
: "${ECOPAC_ADMIN_CORREO:?Falta ECOPAC_ADMIN_CORREO}"
: "${ECOPAC_ADMIN_CLAVE:?Falta ECOPAC_ADMIN_CLAVE}"

if [ "${ECOPAC_CONFIRMAR_VACIADO:-}" != "si" ]; then
  echo "Esto vacia los datos de negocio de la base. Para seguir: ECOPAC_CONFIRMAR_VACIADO=si" >&2
  exit 1
fi

if [ -n "${ECOPAC_REF_PRODUCCION:-}" ] && [[ "$ECOPAC_DB_URL" == *"$ECOPAC_REF_PRODUCCION"* ]]; then
  echo "La cadena de conexion es la de produccion. No se recarga." >&2
  exit 1
fi

psql "$ECOPAC_DB_URL" \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -v correo="$ECOPAC_ADMIN_CORREO" \
  -v clave="$ECOPAC_ADMIN_CLAVE" \
  -f "$aqui/recargar-datos-demo/vaciar-datos-de-negocio.sql" \
  -f "$raiz/supabase/seed-demo.sql" \
  -f "$aqui/recargar-datos-demo/asegurar-administradora.sql"

echo "Datos de demostracion recargados."
