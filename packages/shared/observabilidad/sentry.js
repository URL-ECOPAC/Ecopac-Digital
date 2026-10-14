// Destino de errores hacia Sentry (issue #762), sin su SDK.
//
// POR QUE SIN SDK. Los SDK de Sentry recogen por su cuenta lo que ven: la URL (las rutas llevan el
// UUID del paciente), los breadcrumbs de red y de consola, el usuario. Nada de eso pasa por
// limpiarDatosSensibles(), y apagarlo todo depende de acordarse de cada opcion en cada app. Aqui
// solo sale el reporte que ya armo construirReporteDeError(): limpio por construccion, y el mismo
// codigo para la web y para el movil. Tampoco suma una dependencia nativa a la app de Expo.
//
// El formato es el "envelope" de la API de ingesta de Sentry
// (https://develop.sentry.dev/sdk/data-model/envelopes/): tres lineas de JSON. La autenticacion
// va en la query string, como hace el SDK del navegador, para que el POST sea una peticion simple
// y no dispare el preflight de CORS.
//
// El DSN es publico por diseno, igual que la llave anonima de Supabase: solo sirve para ENVIAR
// eventos a ese proyecto.

const DSN = /^(https?):\/\/([^@/]+)@([^/]+)((?:\/[^/]+)*)\/(\d+)\/?$/;

// Un mismo error repetido en bucle (un render que falla en cada tecla) agotaria la cuota del plan
// gratuito, 5,000 eventos al mes, en una tarde. Se manda una vez por minuto, y como mucho estos
// eventos por sesion de la app.
const VENTANA_DE_REPETICION_MS = 60_000;
const MAXIMO_DE_EVENTOS_POR_SESION = 100;

/**
 * Descompone un DSN de Sentry. Devuelve null si no tiene la forma
 * `https://<llave>@<host>/<proyecto>`.
 *
 * @param {string} dsn
 * @returns {{ urlDeEnvio: string } | null}
 */
export function interpretarDsnDeSentry(dsn) {
  const partes = DSN.exec(String(dsn ?? "").trim());
  if (!partes) return null;
  const [, protocolo, llave, host, prefijo, proyecto] = partes;
  const consulta = `sentry_key=${encodeURIComponent(llave)}&sentry_version=7&sentry_client=ecopac-digital%2F1.0`;
  return {
    urlDeEnvio: `${protocolo}://${host}${prefijo}/api/${proyecto}/envelope/?${consulta}`,
  };
}

function idDeEvento() {
  // No necesita ser criptografico: solo identifica el evento. Hermes no trae crypto.randomUUID.
  let id = "";
  for (let i = 0; i < 32; i += 1) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

/**
 * Convierte un reporte de construirReporteDeError() en el cuerpo de un envelope de Sentry. No
 * agrega nada que no este en el reporte: ni URL, ni usuario, ni dispositivo.
 *
 * @param {ReturnType<import("./errores.js").construirReporteDeError>} reporte
 * @param {{ ambiente?: string, version?: string, plataforma?: string }} [opciones]
 * @returns {string}
 */
export function construirEnvelopeDeSentry(reporte, { ambiente, version, plataforma } = {}) {
  const eventId = idDeEvento();
  const momento = reporte.momento ?? new Date().toISOString();
  const evento = {
    event_id: eventId,
    timestamp: Date.parse(momento) / 1000,
    platform: "javascript",
    level: String(reporte.origen).includes("fatal") ? "fatal" : "error",
    logger: "ecopac",
    environment: ambiente || "desconocido",
    ...(version ? { release: version } : {}),
    exception: {
      values: [{ type: reporte.nombre || "Error", value: reporte.mensaje }],
    },
    tags: {
      origen: reporte.origen,
      ...(plataforma ? { plataforma } : {}),
      ...(reporte.modulo ? { modulo: reporte.modulo } : {}),
      ...(reporte.codigo ? { codigo: reporte.codigo } : {}),
    },
    extra: {
      ruta: reporte.ruta,
      pila: reporte.pila,
      detalle: reporte.detalle,
      pilaDeComponentes: reporte.pilaDeComponentes,
    },
  };

  return [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(evento),
  ].join("\n");
}

/**
 * Crea el destino para configurarDestinoDeErrores() que manda cada reporte a Sentry.
 *
 * - Sin DSN devuelve null: el monitoreo no esta configurado y los errores se quedan en la consola.
 * - Con un DSN mal escrito LANZA: alguien quiso conectarlo y no quedo conectado, y eso no puede
 *   pasar en silencio.
 *
 * El destino tambien escribe en la consola, para que quien desarrolla siga viendo el error. Enviar
 * es asincrono y un fallo del envio (sin red, cuota agotada) no llega a quien reporto.
 *
 * @param {object} opciones
 * @param {string | undefined} opciones.dsn
 * @param {string} [opciones.ambiente] "development", "production"...
 * @param {string} [opciones.version]
 * @param {string} [opciones.plataforma] "web" o "movil".
 * @param {typeof fetch} [opciones.enviar] Inyectable para las pruebas.
 * @param {() => number} [opciones.ahora]
 * @returns {((reporte: object) => void) | null}
 */
export function crearDestinoSentry({
  dsn,
  ambiente,
  version,
  plataforma,
  enviar = globalThis.fetch,
  ahora = Date.now,
} = {}) {
  if (!dsn || !String(dsn).trim()) return null;

  const interpretado = interpretarDsnDeSentry(dsn);
  if (!interpretado) {
    throw new Error(
      "El DSN de Sentry no tiene la forma https://<llave>@<host>/<proyecto>. Revisa VITE_SENTRY_DSN o EXPO_PUBLIC_SENTRY_DSN.",
    );
  }
  if (typeof enviar !== "function") {
    throw new Error("No hay fetch disponible para enviar los reportes de error a Sentry.");
  }

  const ultimoEnvioPorError = new Map();
  let enviados = 0;

  return function destinoSentry(reporte) {
    console.error(`[ecopac] ${reporte.origen}: ${reporte.mensaje}`, reporte);

    const clave = `${reporte.origen}|${reporte.nombre}|${reporte.mensaje}`;
    const momento = ahora();
    const ultimo = ultimoEnvioPorError.get(clave);
    if (ultimo !== undefined && momento - ultimo < VENTANA_DE_REPETICION_MS) return;
    if (enviados >= MAXIMO_DE_EVENTOS_POR_SESION) return;

    ultimoEnvioPorError.set(clave, momento);
    enviados += 1;

    const cuerpo = construirEnvelopeDeSentry(reporte, { ambiente, version, plataforma });
    Promise.resolve()
      .then(() =>
        enviar(interpretado.urlDeEnvio, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: cuerpo,
          keepalive: true,
        }),
      )
      .catch(() => {
        // Sin red o Sentry caido: el error ya quedo en la consola y no hay otro canal. No se
        // reintenta ni se reporta, para no convertir un fallo de red en un bucle de reportes.
      });
  };
}
