#!/usr/bin/env bash
# Comprueba una restauracion: compara las filas de cada tabla de la base restaurada con las que
# traia el respaldo (issue #914, docs/RESPALDO-Y-RECUPERACION.md).
#
# La referencia es `filas-por-tabla.tsv`, que scripts/respaldo-base.sh arma al sacar el respaldo y
# viaja dentro del archivo cifrado. Asi no hace falta consultar la base de origen, que en una
# recuperacion de verdad es justo la que ya no esta.
#
# Uso:
#   bash scripts/comprobar-restauracion.sh ruta/a/filas-por-tabla.tsv
#
# Variables de entorno:
#   ECOPAC_DB_URL  Opcional. Cadena de conexion de la base restaurada; necesita `psql`. Sin ella
#                  se consulta el stack local por `docker exec`, que no pide instalar nada.
#
# Solo imprime nombres de tabla y conteos, nunca filas.

set -euo pipefail

referencia="${1:?Uso: comprobar-restauracion.sh ruta/a/filas-por-tabla.tsv}"

if [ ! -s "$referencia" ]; then
  echo "No existe o esta vacio: $referencia" >&2
  exit 1
fi

consultar() {
  if [ -n "${ECOPAC_DB_URL:-}" ]; then
    psql "$ECOPAC_DB_URL" -v ON_ERROR_STOP=1 -At -F $'\t'
  else
    docker exec -i supabase_db_ecopac-digital psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -F $'\t'
  fi
}

# Una sola consulta con un `select count(*)` por tabla. El nombre viene del volcado ya entre
# comillas ("public"."pacientes"), asi que entra tal cual como identificador; como texto va
# entre $t$ para no depender de sus comillas.
consulta="$(awk -F'\t' '
  NR > 1 { printf " union all\n" }
  { printf "select $t$%s$t$, %d, (select count(*) from %s)", $1, $2, $1 }
' "$referencia")"

resultado="$(printf '%s;\n' "$consulta" | consultar)"

distintas="$(printf '%s\n' "$resultado" | awk -F'\t' '$2 != $3' | tr -d '\r')"
tablas="$(printf '%s\n' "$resultado" | grep -c .)"
filas="$(printf '%s\n' "$resultado" | awk -F'\t' '{ total += $3 } END { print total + 0 }')"

if [ -n "$distintas" ]; then
  echo "La restauracion NO coincide con el respaldo. Tabla, filas en el respaldo, filas restauradas:" >&2
  printf '%s\n' "$distintas" >&2
  exit 1
fi

echo "Restauracion comprobada: $tablas tablas y $filas filas, identicas a las del respaldo."
