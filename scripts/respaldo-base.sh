#!/usr/bin/env bash
# Saca un respaldo cifrado de la base y lo guarda fuera del runner (issue #914).
#
#   1. Vuelca roles, esquema y datos con `supabase db dump` (docs/CI-CD.md, "Respaldo propio").
#   2. Comprueba que los tres volcados tienen contenido, sin imprimirlo.
#   3. Arma un manifiesto con el numero de filas por tabla y la huella de cada archivo: es contra
#      lo que se compara una restauracion (docs/RESPALDO-Y-RECUPERACION.md).
#   4. Empaqueta y cifra con la llave PUBLICA de la organizacion, y borra los volcados en claro.
#   5. Sube el archivo cifrado con rclone y comprueba que llego entero.
#   6. Conserva los RESPALDO_CONSERVAR mas recientes y borra los demas.
#
# Cualquier paso que falle corta el script con codigo distinto de cero: un respaldo que no se
# hizo no puede verse igual que uno que si (lo que paso con el keep-alive, issue #252, punto 4).
#
# UN VOLCADO DE PRODUCCION CONTIENE EXPEDIENTES CLINICOS. Este script nunca imprime contenido de
# los volcados: solo tamanos, conteos y nombres de archivo. No agregarle `set -x`, ni un `cat`,
# `head` o `tail` de los .sql, ni subir nada de aqui como artefacto de GitHub Actions: el
# repositorio es publico y los artefactos los descarga cualquier cuenta.
#
# Variables de entorno (ninguna vive en el repositorio):
#   RESPALDO_CLAVE_PUBLICA  Llave publica GPG de la organizacion, en formato ASCII (armored). Solo
#                           la publica: la privada no se sube a GitHub ni entra a este script.
#   RESPALDO_DESTINO        Destino de rclone, por ejemplo `drive:respaldos-ecopac-digital`. Una
#                           ruta local tambien vale, y es lo que se usa para ensayar.
#   RESPALDO_CONSERVAR      Opcional. Cuantos respaldos se conservan. Por defecto 30.
#   RESPALDO_AMBIENTE       Opcional. Nombre que lleva el archivo. Por defecto `ecopac-prod`.
#   RESPALDO_ORIGEN         Opcional. `linked` (por defecto): el proyecto vinculado con
#                           `supabase link`. `local`: el stack local, para ensayar.
#
# Con RESPALDO_ORIGEN=linked hacen falta ademas las que pide la CLI: SUPABASE_ACCESS_TOKEN y
# SUPABASE_DB_PASSWORD, y haber corrido antes `supabase link --project-ref <ref>`.
#
# Necesita en el PATH: supabase, gpg, rclone, tar, awk y sha256sum. Y Docker, que es donde la CLI
# corre pg_dump.

set -euo pipefail

# Lo que este script deja en disco es legible solo por quien lo corre.
umask 077

fallar() {
  echo "::error title=Respaldo no realizado::$1"
  echo "ERROR: $1" >&2
  exit 1
}

: "${RESPALDO_CLAVE_PUBLICA:?Falta RESPALDO_CLAVE_PUBLICA}"
: "${RESPALDO_DESTINO:?Falta RESPALDO_DESTINO}"

conservar="${RESPALDO_CONSERVAR:-30}"
ambiente="${RESPALDO_AMBIENTE:-ecopac-prod}"
origen="${RESPALDO_ORIGEN:-linked}"

if ! [[ "$conservar" =~ ^[1-9][0-9]*$ ]]; then
  fallar "RESPALDO_CONSERVAR tiene que ser un entero mayor que cero (vale '$conservar')."
fi

if ! [[ "$ambiente" =~ ^[a-z0-9-]+$ ]]; then
  fallar "RESPALDO_AMBIENTE solo admite minusculas, numeros y guiones (vale '$ambiente')."
fi

case "$origen" in
  linked | local) ;;
  *) fallar "RESPALDO_ORIGEN tiene que ser 'linked' o 'local' (vale '$origen')." ;;
esac

for herramienta in supabase gpg rclone tar awk sha256sum; do
  if ! command -v "$herramienta" > /dev/null 2>&1; then
    fallar "Falta '$herramienta' en el PATH."
  fi
done

# La llave privada no tiene nada que hacer aqui: con ella en un secret de GitHub, quien lea los
# secrets podria descifrar todos los respaldos. Si alguien la pego por error, se corta antes de
# usarla.
if [[ "$RESPALDO_CLAVE_PUBLICA" == *"PRIVATE KEY"* ]]; then
  fallar "RESPALDO_CLAVE_PUBLICA contiene una llave PRIVADA. Va solo la publica; esa llave privada ya no es segura y hay que generar un par nuevo."
fi

trabajo="$(mktemp -d)"
# Pase lo que pase, los volcados en claro no sobreviven al script.
trap 'rm -rf "$trabajo"' EXIT

volcado="$trabajo/volcado"
salida="$trabajo/salida"
export GNUPGHOME="$trabajo/gnupg"
mkdir -p "$volcado" "$salida" "$GNUPGHOME"

# --- 1. Volcado ----------------------------------------------------------------------------------

echo "Volcando roles, esquema y datos de $ambiente (origen: $origen)..."
supabase db dump "--$origen" --role-only -f "$volcado/roles.sql"
supabase db dump "--$origen" -f "$volcado/esquema.sql"
supabase db dump "--$origen" --data-only --use-copy -f "$volcado/datos.sql"

# --- 2. Comprobacion -----------------------------------------------------------------------------

# Un `db dump` que termina con codigo 0 y un archivo vacio es justo el fallo silencioso que este
# script existe para no tener. Se mira el contenido sin mostrarlo.
for archivo in roles.sql esquema.sql datos.sql; do
  if [ ! -s "$volcado/$archivo" ]; then
    fallar "El volcado $archivo salio vacio."
  fi
done

if ! grep -q "CREATE TABLE" "$volcado/esquema.sql"; then
  fallar "esquema.sql no define ninguna tabla."
fi

# --- 3. Manifiesto -------------------------------------------------------------------------------

# Filas por tabla, contadas en el propio volcado: cada bloque va de una linea `COPY ... FROM
# stdin;` a una linea `\.`. Es la referencia contra la que se comparan los `select count(*)`
# despues de restaurar, sin tener que consultar otra vez la base de origen.
awk '
  dentro && /^\\\.$/ { print tabla "\t" filas; dentro = 0; next }
  dentro             { filas++; next }
  /^COPY /           { tabla = $2; filas = 0; dentro = 1 }
' "$volcado/datos.sql" > "$volcado/filas-por-tabla.tsv"

tablas="$(wc -l < "$volcado/filas-por-tabla.tsv" | tr -d ' ')"
filas="$(awk -F'\t' '{ total += $2 } END { print total + 0 }' "$volcado/filas-por-tabla.tsv")"

# Aun sin datos de pacientes, las migraciones siembran catalogos y el primer administrador
# (docs/CI-CD.md, "Prueba de restauracion"): un volcado de datos sin filas no es una base vacia,
# es un volcado que no funciono.
if [ "$tablas" -eq 0 ] || [ "$filas" -eq 0 ]; then
  fallar "datos.sql no trae ninguna fila ($tablas tablas, $filas filas)."
fi

marca="$(date -u +%Y%m%dT%H%M%SZ)"
nombre="respaldo-$ambiente-$marca.tar.gz.gpg"

{
  echo "Respaldo de $ambiente"
  echo "Generado (UTC): $marca"
  echo "Commit del repositorio: ${GITHUB_SHA:-$(git rev-parse HEAD 2> /dev/null || echo desconocido)}"
  echo "Supabase CLI: $(supabase --version 2> /dev/null | head -n 1)"
  echo "Tablas con datos volcados: $tablas"
  echo "Filas en total: $filas"
  echo
  echo "Huellas SHA-256:"
  (cd "$volcado" && sha256sum roles.sql esquema.sql datos.sql filas-por-tabla.tsv)
} > "$volcado/MANIFIESTO.txt"

# --- 4. Cifrado ----------------------------------------------------------------------------------

printf '%s\n' "$RESPALDO_CLAVE_PUBLICA" | gpg --batch --quiet --import

huellas="$(gpg --batch --with-colons --list-keys | awk -F: '$1 == "pub" { esperar = 1 } esperar && $1 == "fpr" { print $10; esperar = 0 }')"
if [ "$(printf '%s\n' "$huellas" | grep -c .)" -ne 1 ]; then
  fallar "RESPALDO_CLAVE_PUBLICA tiene que traer exactamente una llave publica."
fi

# `--trust-model always`: el llavero es nuevo en cada corrida y la unica llave que tiene es la
# que acaba de importar, asi que no hay red de confianza que consultar.
tar -C "$volcado" -czf - roles.sql esquema.sql datos.sql filas-por-tabla.tsv MANIFIESTO.txt \
  | gpg --batch --yes --trust-model always --recipient "$huellas" --encrypt --output "$salida/$nombre"

# Los volcados en claro ya no hacen falta: se borran ANTES de abrir cualquier conexion de subida,
# para que lo unico que pueda salir del runner sea el archivo cifrado.
rm -rf "$volcado"

# Lo que se va a subir tiene que ser un mensaje OpenPGP cifrado para esa llave. Sin la llave
# privada `--list-packets` no puede descifrar y termina con error, pero antes lista el paquete de
# la llave publica destinataria, que es lo que se busca.
if ! (gpg --batch --list-packets "$salida/$nombre" 2>&1 || true) | grep -q "pubkey enc packet"; then
  fallar "El archivo generado no esta cifrado con la llave publica. No se sube nada."
fi

tamano="$(wc -c < "$salida/$nombre" | tr -d ' ')"
echo "Respaldo cifrado: $nombre ($tamano bytes, $tablas tablas, $filas filas)."

# --- 5. Subida -----------------------------------------------------------------------------------

rclone copyto "$salida/$nombre" "$RESPALDO_DESTINO/$nombre"

# `check` compara tamano y huella del archivo local con el que quedo en el destino: una subida
# cortada a la mitad no pasa.
rclone check "$salida" "$RESPALDO_DESTINO" --include "$nombre" --one-way

# --- 6. Retencion --------------------------------------------------------------------------------

# Solo se llega aqui con el respaldo nuevo subido y comprobado: si la subida falla, no se borra
# ninguno de los anteriores. El filtro limita el borrado a los archivos que genera este script
# para este ambiente; cualquier otra cosa que haya en la carpeta no se toca.
patron="respaldo-$ambiente-*.tar.gz.gpg"
lista="$(rclone lsf --files-only --include "$patron" "$RESPALDO_DESTINO")"

# El nombre lleva la fecha en UTC con formato fijo, asi que el orden alfabetico es el cronologico.
mapfile -t existentes < <(printf '%s\n' "$lista" | grep . | sort)

if ! printf '%s\n' "${existentes[@]}" | grep -qxF "$nombre"; then
  fallar "El respaldo $nombre no aparece en el destino despues de subirlo."
fi

sobran=$((${#existentes[@]} - conservar))
borrados=0
if [ "$sobran" -gt 0 ]; then
  for viejo in "${existentes[@]:0:$sobran}"; do
    # Sin papelera: en Drive un archivo en la papelera sigue ocupando cuota y sigue existiendo 30
    # dias, y la retencion dice cuantos respaldos existen, no cuantos se ven.
    rclone deletefile --drive-use-trash=false "$RESPALDO_DESTINO/$viejo"
    echo "Borrado por retencion: $viejo"
    borrados=$((borrados + 1))
  done
fi

quedan=$((${#existentes[@]} - borrados))
echo "Respaldos conservados: $quedan de un maximo de $conservar."

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Respaldo de $ambiente realizado"
    echo
    echo "| Dato | Valor |"
    echo "| --- | --- |"
    echo "| Archivo | \`$nombre\` |"
    echo "| Tamano cifrado | $tamano bytes |"
    echo "| Tablas volcadas | $tablas |"
    echo "| Filas en total | $filas |"
    echo "| Respaldos conservados | $quedan de $conservar |"
    echo "| Borrados por retencion | $borrados |"
    echo
    echo "El archivo esta cifrado: para restaurarlo hace falta la llave privada de la organizacion."
    echo "Procedimiento en \`docs/RESPALDO-Y-RECUPERACION.md\`."
  } >> "$GITHUB_STEP_SUMMARY"
fi

echo "Respaldo terminado."
