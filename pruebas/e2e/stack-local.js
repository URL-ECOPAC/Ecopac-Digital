// De donde salen la URL y las llaves del stack local (issue #222).
//
// NINGUNA CREDENCIAL SE ESCRIBE EN EL REPOSITORIO. Las llaves del stack local son distintas en
// cada maquina y en cada corrida del CI, y aunque la anonima es publica por diseno, escribirla
// aqui invitaria a escribir tambien la de servicio al lado -- justo lo que prohibe la revision
// de configuracion (issue #241, OWASP A05). Se leen en tiempo de ejecucion de `supabase status`,
// que es la fuente autoritativa y ya esta instalada donde estas pruebas pueden correr.
//
// Las variables de entorno tienen prioridad para que el CI pueda inyectarlas sin volver a
// invocar el CLI, y para que quien tenga el stack en puertos distintos no tenga que tocar codigo.

import { execSync } from "node:child_process";

/** Nombres tal como los imprime `supabase status -o env`. */
const CLAVES = {
  apiUrl: "API_URL",
  anonKey: "ANON_KEY",
  dbUrl: "DB_URL",
};

/** Sobrescritura por entorno, para el CI y para stacks en puertos no estandar. */
const VARIABLES_DE_ENTORNO = {
  apiUrl: "SUPABASE_API_URL",
  anonKey: "SUPABASE_ANON_KEY",
  dbUrl: "SUPABASE_DB_URL",
};

let configuracion = null;

/**
 * Convierte la salida de `supabase status -o env` en un objeto.
 *
 * El CLI mezcla avisos (WARN:, "Stopped services: ...") con los pares KEY=VALUE, y entrecomilla
 * unos valores si y otros no. Se ignora toda linea que no tenga la forma NOMBRE=valor.
 */
function interpretarSalida(salida) {
  const valores = {};

  for (const linea of salida.split(/\r?\n/)) {
    const coincidencia = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (!coincidencia) continue;

    const [, nombre, crudo] = coincidencia;
    valores[nombre] = crudo.replace(/^"(.*)"$/, "$1");
  }

  return valores;
}

function leerDelCli() {
  try {
    // stderr se descarta: el CLI escribe ahi avisos de configuracion y la lista de servicios
    // apagados, que no son errores y solo ensucian el reporte de las pruebas.
    return interpretarSalida(
      execSync("supabase status -o env", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch (error) {
    throw new Error(
      "No se pudo leer la configuracion del stack local. Estas pruebas necesitan Supabase " +
        "corriendo: ejecuta `supabase start` y despues `supabase db reset` (el seed de " +
        "supabase/seed-demo.sql es el que crea las cuentas y los datos que usan). " +
        `Detalle: ${error.message}`,
    );
  }
}

/**
 * URL de la API, llave anonima y cadena de conexion del Postgres local.
 *
 * Se resuelve una sola vez por proceso: invocar el CLI cuesta cerca de un segundo y el valor
 * no cambia mientras el stack sigue arriba.
 *
 * @returns {{ apiUrl: string, anonKey: string, dbUrl: string }}
 */
export function configuracionDelStackLocal() {
  if (configuracion !== null) return configuracion;

  const porEntorno = Object.entries(VARIABLES_DE_ENTORNO).map(([campo, variable]) => [
    campo,
    process.env[variable],
  ]);

  const faltaAlguna = porEntorno.some(([, valor]) => !valor);
  const delCli = faltaAlguna ? leerDelCli() : {};

  configuracion = Object.fromEntries(
    porEntorno.map(([campo, valor]) => [campo, valor || delCli[CLAVES[campo]]]),
  );

  const vacios = Object.entries(configuracion)
    .filter(([, valor]) => !valor)
    .map(([campo]) => CLAVES[campo]);

  if (vacios.length > 0) {
    throw new Error(
      `El stack local no reporto ${vacios.join(", ")}. Revisa que \`supabase start\` haya ` +
        "terminado bien.",
    );
  }

  return configuracion;
}
