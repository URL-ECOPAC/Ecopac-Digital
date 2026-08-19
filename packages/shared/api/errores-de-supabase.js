// Traduccion de los errores del servidor a algo que se le pueda ensenar a una persona.
//
// Sin esta capa, una enfermera en jornada veria en pantalla
// `duplicate key value violates unique constraint "pacientes_dpi_key"`: no le dice que hacer
// y de paso le ensena el nombre de una tabla.
//
// Dos reglas gobiernan este archivo:
//
//   1. El mensaje que se muestra SIEMPRE se escribe aqui. Nunca se reenvia el texto del
//      servidor, porque es por ahi por donde se filtran nombres de tabla y fragmentos de SQL.
//   2. El detalle tecnico se conserva para el log, pero SANEADO. supabase-js documenta que
//      PostgrestError.details trae "often the offending value, key, or row", asi que una
//      violacion de unicidad sobre pacientes dejaria un DPI en los registros. La regla de
//      confidencialidad de AGENTS.md prohibe datos de pacientes en los logs.
//
// No confundir con errores.js, que son errores de programacion y los lee el desarrollador.
// Estos los lee el usuario final.

import { labels } from "@ecopac/ui-tokens";

/** Clasificacion del error, para que quien lo atrape decida sin leer el texto. */
export const CODIGOS_DE_ERROR_DE_SUPABASE = {
  UNICIDAD: "unicidad",
  LLAVE_FORANEA: "llave_foranea",
  CHECK: "check",
  CAMPO_REQUERIDO: "campo_requerido",
  PERMISO_DENEGADO: "permiso_denegado",
  SESION_EXPIRADA: "sesion_expirada",
  CREDENCIALES_INVALIDAS: "credenciales_invalidas",
  CUENTA_DESACTIVADA: "cuenta_desactivada",
  SIN_RESULTADOS: "sin_resultados",
  FALLO_DE_RED: "fallo_de_red",
  DESCONOCIDO: "desconocido",
};

/**
 * Codigos SQLSTATE de PostgreSQL que llegan a traves de PostgREST.
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const SQLSTATE = {
  NOT_NULL_VIOLATION: "23502",
  FOREIGN_KEY_VIOLATION: "23503",
  UNIQUE_VIOLATION: "23505",
  CHECK_VIOLATION: "23514",
  INSUFFICIENT_PRIVILEGE: "42501",
};

/** Codigos propios de PostgREST. */
const POSTGREST = {
  JWT_INVALIDO: "PGRST301",
  SIN_FILAS: "PGRST116",
};

/**
 * Mensaje por clasificacion. Son textos propios, no del servidor.
 *
 * Dicen que hacer y no solo que fallo: quien los lee esta atendiendo pacientes, no depurando.
 */
const MENSAJES = {
  [CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD]:
    "Ese registro ya existe. Revisa los datos e intenta de nuevo.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.LLAVE_FORANEA]:
    "El registro esta relacionado con otros datos, asi que no se puede guardar o eliminar tal " +
    "como esta. Revisa que lo que seleccionaste siga existiendo.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.CHECK]:
    "Alguno de los datos no cumple las reglas del sistema. Revisa el formulario y corrige lo " +
    "que este marcado.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO]:
    "Falta un dato obligatorio. Completa el formulario e intenta de nuevo.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO]:
    "Tu usuario no tiene permiso para hacer esto. Si crees que deberia tenerlo, pideselo a la " +
    "administradora.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.SESION_EXPIRADA]:
    "Tu sesion expiro. Inicia sesion de nuevo para continuar.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS]:
    "El correo o la contrasena no son correctos.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA]:
    "Tu usuario esta desactivado. Pide a la administradora que lo reactive para volver a entrar.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS]: "No se encontro el registro que buscabas.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED]:
    `${labels.errorDeConexion}. Revisa tu conexion e intenta de nuevo; ` +
    "los datos que escribiste no se perdieron.",
  [CODIGOS_DE_ERROR_DE_SUPABASE.DESCONOCIDO]:
    "Ocurrio un error inesperado. Intenta de nuevo; si sigue pasando, avisa a la administradora.",
};

/**
 * Clasificaciones que vale la pena reintentar.
 *
 * Lo consume el manejo global de errores (#231) para no tener que volver a olfatear el error.
 * Un fallo de unicidad o de permisos no cambia por insistir; uno de red, si.
 */
const REINTENTABLES = new Set([CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED]);

/**
 * Quita de un texto tecnico los literales, que es donde viajan los datos de la fila.
 *
 * `Key (dpi)=(2547891230101) already exists.` queda como `Key (...)=(...) already exists.`:
 * se conserva la forma del problema, que es lo que sirve para diagnosticar, y desaparece el
 * dato del paciente. Tambien se recorta, porque un log no necesita parrafos.
 */
export function sanearDetalle(texto) {
  if (typeof texto !== "string" || texto.trim() === "") return "";

  return texto
    .replace(/\([^)]*\)/g, "(...)")
    .replace(/'[^']*'/g, "'...'")
    .replace(/"[^"]*"/g, '"..."')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Nombre de la restriccion que fallo, si el mensaje del servidor lo menciona. */
function nombreDeRestriccion(mensaje) {
  const encontrado = /constraint "([a-z0-9_]+)"/i.exec(mensaje ?? "");
  return encontrado ? encontrado[1] : "";
}

/**
 * Reconoce un fallo de red.
 *
 * El mensaje cambia segun la plataforma: el navegador dice "Failed to fetch" y React Native
 * "Network request failed". supabase-js ademas envuelve algunos en AuthRetryableFetchError.
 */
export function esErrorDeRed(error) {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;

  const mensaje = String(error.message ?? error).toLowerCase();
  return (
    mensaje.includes("failed to fetch") ||
    mensaje.includes("network request failed") ||
    mensaje.includes("networkerror") ||
    mensaje.includes("fetch failed")
  );
}

/** Un error de Supabase Auth se marca a si mismo, sin importar la subclase. */
function esErrorDeAuth(error) {
  return Boolean(error && (error.__isAuthError || error.name?.startsWith("Auth")));
}

/** Clasifica un error de Auth por su codigo o, si no lo trae, por su estado HTTP. */
function clasificarAuth(error) {
  const codigo = String(error.code ?? "").toLowerCase();

  if (codigo.includes("invalid_credentials") || codigo.includes("invalid_grant")) {
    return CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS;
  }
  if (codigo.includes("session") || codigo.includes("token") || codigo.includes("jwt")) {
    return CODIGOS_DE_ERROR_DE_SUPABASE.SESION_EXPIRADA;
  }
  if (error.status === 400 || error.status === 401) {
    return CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS;
  }
  if (error.status === 403) return CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO;

  return CODIGOS_DE_ERROR_DE_SUPABASE.DESCONOCIDO;
}

/** Clasifica un error de PostgREST o de Postgres por su codigo. */
function clasificarPostgrest(error) {
  switch (error.code) {
    case SQLSTATE.UNIQUE_VIOLATION:
      return CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD;
    case SQLSTATE.FOREIGN_KEY_VIOLATION:
      return CODIGOS_DE_ERROR_DE_SUPABASE.LLAVE_FORANEA;
    case SQLSTATE.CHECK_VIOLATION:
      return CODIGOS_DE_ERROR_DE_SUPABASE.CHECK;
    case SQLSTATE.NOT_NULL_VIOLATION:
      return CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO;
    case SQLSTATE.INSUFFICIENT_PRIVILEGE:
      return CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO;
    case POSTGREST.JWT_INVALIDO:
      return CODIGOS_DE_ERROR_DE_SUPABASE.SESION_EXPIRADA;
    case POSTGREST.SIN_FILAS:
      return CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS;
    default:
      return CODIGOS_DE_ERROR_DE_SUPABASE.DESCONOCIDO;
  }
}

/**
 * Arma el detalle tecnico para el log: codigo, restriccion y resumen saneado.
 *
 * Nunca se incluye `hint`: para el codigo 42501 PostgREST devuelve ahi el SQL literal que
 * arreglaria el permiso (`GRANT SELECT ON public.pacientes TO anon;`), que es exactamente lo
 * que no queremos ni en pantalla ni en el log.
 */
function construirDetalle(error) {
  const partes = [];

  if (error?.code) partes.push(String(error.code));

  const restriccion = nombreDeRestriccion(error?.message);
  if (restriccion) partes.push(restriccion);

  // `||` y no `??`: PostgrestError trae details como cadena vacia muy a menudo, y ahi el
  // contexto util esta en message. Con `??` el detalle se quedaria solo en el codigo.
  const resumen = sanearDetalle(error?.details || error?.message);
  if (resumen) partes.push(resumen);

  return partes.join(" | ");
}

/**
 * Arma el objeto uniforme a partir de una clasificacion ya decidida.
 *
 * No todo error nace de una respuesta del servidor. Que un perfil este desactivado es una
 * regla del sistema que el cliente comprueba por su cuenta, y aun asi tiene que llegar a la
 * pantalla con la misma forma que los demas para que quien la muestra no distinga de donde
 * vino. El texto sigue saliendo de MENSAJES, que es la regla 1 de este archivo.
 *
 * @param {string} codigo Uno de CODIGOS_DE_ERROR_DE_SUPABASE.
 * @param {string} [detalle] Contexto tecnico para el log. Ya saneado por quien llama.
 * @returns {{ codigo: string, mensaje: string, detalle: string, esReintentable: boolean }}
 */
export function construirError(codigo, detalle = "") {
  return {
    codigo,
    // Siempre hay mensaje: quedarse sin texto que mostrar es peor que un texto generico.
    mensaje: MENSAJES[codigo] ?? MENSAJES[CODIGOS_DE_ERROR_DE_SUPABASE.DESCONOCIDO],
    detalle,
    esReintentable: REINTENTABLES.has(codigo),
  };
}

/**
 * Convierte cualquier error de Supabase en un objeto uniforme.
 *
 * @param {unknown} error Lo que devolvio supabase-js, o lo que sea que llego.
 * @returns {{ codigo: string, mensaje: string, detalle: string, esReintentable: boolean }}
 *   `mensaje` es apto para pantalla; `detalle` es para el log y no debe mostrarse.
 */
export function normalizarError(error) {
  // El orden importa: un fallo de red puede llegar disfrazado de error de Auth, y un error
  // sin codigo no debe caer en la rama de Postgres.
  let codigo;

  if (esErrorDeRed(error)) {
    codigo = CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED;
  } else if (esErrorDeAuth(error)) {
    codigo = clasificarAuth(error);
  } else if (error?.code) {
    codigo = clasificarPostgrest(error);
  } else {
    codigo = CODIGOS_DE_ERROR_DE_SUPABASE.DESCONOCIDO;
  }

  return construirError(codigo, construirDetalle(error));
}
