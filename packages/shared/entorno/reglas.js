// Reglas de validacion de las variables de entorno de Supabase.
//
// Este archivo es deliberadamente puro: no lee variables, no toca el bundler y no usa
// ningun global de plataforma. Recibe los valores ya leidos y decide si sirven. Asi puede
// ejecutarse en Node tal cual, y las pruebas de la infraestructura compartida lo cubriran
// sin necesidad de levantar Vite ni Metro.
//
// Quien lee las variables de cada plataforma es fuente.js (web) y fuente.native.js (movil).

/** Plataformas que sabemos resolver. El valor viaja en el resultado para poder depurar. */
export const PLATAFORMAS = {
  WEB: "web",
  MOVIL: "movil",
};

/**
 * Nombres exactos de las variables en cada plataforma.
 *
 * Vite solo expone al cliente las variables con prefijo VITE_ y Expo solo las que llevan
 * EXPO_PUBLIC_. Son los mismos dos valores de Supabase con dos nombres distintos; ver la
 * tabla de docs/QUICKSTART.md y el archivo .env.example.
 */
export const NOMBRES_DE_VARIABLES = {
  [PLATAFORMAS.WEB]: {
    url: "VITE_SUPABASE_URL",
    anonKey: "VITE_SUPABASE_ANON_KEY",
  },
  [PLATAFORMAS.MOVIL]: {
    url: "EXPO_PUBLIC_SUPABASE_URL",
    anonKey: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  },
};

/** Archivo donde el desarrollador debe definir las variables, segun el ambiente. */
export const ARCHIVOS_DE_ENTORNO = {
  desarrollo: ".env.development",
  produccion: ".env.production",
};

/** Codigos de error, para que quien atrape el error pueda distinguir el caso sin leer el texto. */
export const CODIGOS_DE_ERROR = {
  VARIABLE_FALTANTE: "variable_faltante",
  URL_INVALIDA: "url_invalida",
  LLAVE_INVALIDA: "llave_invalida",
  LLAVE_DE_SERVICIO: "llave_de_servicio",
  PLATAFORMA_DESCONOCIDA: "plataforma_desconocida",
};

/**
 * Error de configuracion del entorno.
 *
 * Se lanza al arrancar, no a media consulta: un .env incompleto tiene que notarse antes de
 * que alguien crea que la aplicacion funciona.
 */
export class ErrorDeEntorno extends Error {
  constructor(mensaje, { codigo, variable = null } = {}) {
    super(mensaje);
    this.name = "ErrorDeEntorno";
    this.codigo = codigo;
    this.variable = variable;
  }
}

/** Hosts donde se acepta http:// porque son la instancia local de Supabase. */
const HOSTS_LOCALES = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

/**
 * Rangos de IP privada (RFC 1918) donde se acepta http:// en desarrollo movil.
 *
 * Expo Go en un telefono fisico no puede resolver "localhost" -eso apunta al propio telefono-
 * asi que el .env de desarrollo movil apunta al host de Metro por su IP de LAN
 * (192.168.x.x, 10.x.x.x o 172.16-31.x.x). Esa red no tiene certificado https valido, y pedirlo
 * bloquearia probar en dispositivo. Nunca se activa fuera de desarrollo movil: ver esDesarrollo
 * en validarUrl.
 */
const PATRON_IP_PRIVADA =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;

/** Prefijo de las llaves publicables del formato nuevo de Supabase. */
const PREFIJO_LLAVE_PUBLICA = "sb_publishable_";

/** Prefijo de las llaves secretas del formato nuevo. Nunca deben llegar al cliente. */
const PREFIJO_LLAVE_SECRETA = "sb_secret_";

/**
 * Pista de como corregir el problema, distinta por plataforma.
 *
 * Expo inlinea las EXPO_PUBLIC_* al empaquetar, asi que editar el .env sin reiniciar Metro
 * con la cache limpia no cambia nada y el error parece no desaparecer.
 */
function comoCorregir(plataforma) {
  const archivo = ARCHIVOS_DE_ENTORNO.desarrollo;
  if (plataforma === PLATAFORMAS.MOVIL) {
    return (
      `Copia .env.example a ${archivo}, llena el valor y reinicia Expo con la cache limpia ` +
      `(npm run dev:mobile -- --clear): las variables EXPO_PUBLIC_ se incrustan al empaquetar.`
    );
  }
  return (
    `Copia .env.example a ${archivo}, llena el valor y reinicia el servidor de Vite: ` +
    `las variables VITE_ se leen al arrancar.`
  );
}

/** Decodifica base64url a texto sin depender de atob ni de Buffer, que no existen en todas partes. */
const ALFABETO_BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodificarBase64Url(segmento) {
  const base64 = segmento.replace(/-/g, "+").replace(/_/g, "/");
  let bits = 0;
  let acumulado = 0;
  let texto = "";

  for (const caracter of base64) {
    const valor = ALFABETO_BASE64.indexOf(caracter);
    // El relleno "=" y cualquier caracter fuera del alfabeto se ignoran.
    if (valor === -1) continue;
    acumulado = (acumulado << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      texto += String.fromCharCode((acumulado >> bits) & 0xff);
    }
  }

  return texto;
}

/**
 * Rol que declara un JWT de Supabase, o null si la llave no es un JWT legible.
 *
 * Solo se usa para distinguir la llave anon de la service_role: no valida la firma ni
 * pretende hacerlo, esa verificacion es del servidor.
 */
function rolDeclaradoEnLaLlave(llave) {
  const segmentos = llave.split(".");
  if (segmentos.length !== 3) return null;

  try {
    const carga = JSON.parse(decodificarBase64Url(segmentos[1]));
    return typeof carga?.role === "string" ? carga.role : null;
  } catch {
    return null;
  }
}

/**
 * Forma minima de una URL absoluta: esquema, dos puntos y dos barras.
 *
 * React Native trae su propia clase URL (Libraries/Blob/URL.js, registrada como global por
 * setUpXHR.js) que resuelve todo con expresiones regulares y NO lanza con una cadena
 * malformada, a diferencia del navegador y de Node. Sin esta comprobacion previa, un valor
 * basura daria en movil el mensaje de "debe usar https", que manda a buscar el problema
 * equivocado. Se valida la forma a mano para que las dos plataformas digan lo mismo.
 */
const FORMA_DE_URL_ABSOLUTA = /^[a-z][a-z\d+\-.]*:\/\//i;

/** Valida y normaliza la URL del proyecto de Supabase. */
function validarUrl(valor, nombreDeVariable, plataforma, esDesarrollo) {
  let url;
  try {
    if (!FORMA_DE_URL_ABSOLUTA.test(valor)) throw new TypeError("URL sin esquema");
    url = new URL(valor);
  } catch {
    throw new ErrorDeEntorno(
      `${nombreDeVariable} no es una URL valida. Se espera algo como ` +
        `https://xxxxxxxx.supabase.co (Project Settings > API > Project URL).`,
      { codigo: CODIGOS_DE_ERROR.URL_INVALIDA, variable: nombreDeVariable },
    );
  }

  const esLocal = HOSTS_LOCALES.includes(url.hostname);
  // Gateado a desarrollo movil a proposito: en produccion (o en web) http contra una IP de LAN
  // sigue rechazado, la sesion viajaria sin TLS fuera de la maquina de quien desarrolla.
  const esIpDeLanEnDesarrolloMovil =
    esDesarrollo && plataforma === PLATAFORMAS.MOVIL && PATRON_IP_PRIVADA.test(url.hostname);

  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && (esLocal || esIpDeLanEnDesarrolloMovil))
  ) {
    throw new ErrorDeEntorno(
      `${nombreDeVariable} debe usar https. Solo se acepta http contra la instancia local ` +
        `de Supabase (${HOSTS_LOCALES.join(", ")}) o, en desarrollo movil, contra una IP de LAN ` +
        `(192.168.x.x, 10.x.x.x, 172.16-31.x.x). ${comoCorregir(plataforma)}`,
      { codigo: CODIGOS_DE_ERROR.URL_INVALIDA, variable: nombreDeVariable },
    );
  }

  // Sin barra final: el cliente de Supabase arma las rutas concatenando y una barra de mas
  // produce peticiones a //rest/v1 que algunos proxys rechazan.
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/**
 * Valida la llave anonima y rechaza la service_role.
 *
 * La service_role salta todas las politicas RLS: si llega al bundle del cliente, cualquiera
 * que abra las herramientas de desarrollo puede leer el expediente de cualquier paciente.
 * Por eso el rechazo esta en el codigo y no solo en la documentacion. El mensaje nunca
 * imprime el valor de la llave.
 */
function validarLlaveAnonima(valor, nombreDeVariable, plataforma) {
  if (valor.startsWith(PREFIJO_LLAVE_SECRETA)) {
    throw new ErrorDeEntorno(
      `${nombreDeVariable} contiene una llave secreta (${PREFIJO_LLAVE_SECRETA}...). ` +
        `Esa llave nunca va en el cliente: usa la llave publicable o la anon/public. ` +
        `${comoCorregir(plataforma)}`,
      { codigo: CODIGOS_DE_ERROR.LLAVE_DE_SERVICIO, variable: nombreDeVariable },
    );
  }

  if (valor.startsWith(PREFIJO_LLAVE_PUBLICA)) {
    return valor;
  }

  const rol = rolDeclaradoEnLaLlave(valor);
  if (rol === null) {
    throw new ErrorDeEntorno(
      `${nombreDeVariable} no tiene el formato de una llave de Supabase. Se espera un JWT ` +
        `(eyJ...) o una llave ${PREFIJO_LLAVE_PUBLICA}... tomada de ` +
        `Project Settings > API > Project API keys. ${comoCorregir(plataforma)}`,
      { codigo: CODIGOS_DE_ERROR.LLAVE_INVALIDA, variable: nombreDeVariable },
    );
  }

  if (rol === "service_role") {
    throw new ErrorDeEntorno(
      `${nombreDeVariable} contiene la llave service_role. Esa llave salta las politicas RLS ` +
        `y nunca puede viajar al cliente: usa la llave anon/public. ${comoCorregir(plataforma)}`,
      { codigo: CODIGOS_DE_ERROR.LLAVE_DE_SERVICIO, variable: nombreDeVariable },
    );
  }

  return valor;
}

/** Trata los valores ausentes y los que solo tienen espacios como si no existieran. */
function normalizar(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function exigirPresencia(valor, nombreDeVariable, plataforma) {
  if (valor !== "") return valor;

  throw new ErrorDeEntorno(`Falta ${nombreDeVariable}. ${comoCorregir(plataforma)}`, {
    codigo: CODIGOS_DE_ERROR.VARIABLE_FALTANTE,
    variable: nombreDeVariable,
  });
}

/**
 * Convierte los valores crudos de una plataforma en la configuracion que consume el cliente
 * de Supabase, o lanza ErrorDeEntorno explicando que falta y donde arreglarlo.
 *
 * @param {object} fuente
 * @param {"web"|"movil"} fuente.plataforma
 * @param {{ url?: string, anonKey?: string }} fuente.valores
 * @param {boolean} [fuente.esDesarrollo] Ambiente de desarrollo segun el bundler de la
 *   plataforma (import.meta.env.DEV en Vite, __DEV__ en Expo/Metro). Solo habilita la
 *   excepcion de http:// contra IP de LAN en movil; en produccion o en web no cambia nada.
 * @returns {{ supabaseUrl: string, supabaseAnonKey: string, plataforma: string }}
 */
export function resolverEntorno({ plataforma, valores, esDesarrollo = false } = {}) {
  const nombres = NOMBRES_DE_VARIABLES[plataforma];
  if (!nombres) {
    throw new ErrorDeEntorno(
      `Plataforma desconocida: ${plataforma}. Se esperaba ` +
        `${Object.values(PLATAFORMAS).join(" o ")}.`,
      { codigo: CODIGOS_DE_ERROR.PLATAFORMA_DESCONOCIDA },
    );
  }

  const urlCruda = exigirPresencia(normalizar(valores?.url), nombres.url, plataforma);
  const llaveCruda = exigirPresencia(normalizar(valores?.anonKey), nombres.anonKey, plataforma);

  return {
    supabaseUrl: validarUrl(urlCruda, nombres.url, plataforma, esDesarrollo),
    supabaseAnonKey: validarLlaveAnonima(llaveCruda, nombres.anonKey, plataforma),
    plataforma,
  };
}
