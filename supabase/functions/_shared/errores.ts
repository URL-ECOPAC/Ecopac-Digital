// Reporte de errores de las Edge Functions (issue #762).
//
// Espejo, para Deno, de packages/shared/observabilidad/errores.js y sentry.js: el error se escribe
// en los logs de la funcion (Supabase los guarda) y, si el secret SENTRY_DSN existe, se manda
// tambien a Sentry. Sin el secret, solo el log, como hasta ahora.
//
// POR QUE UNA COPIA Y NO UN IMPORT. `supabase functions deploy` empaqueta el grafo de imports a
// partir de supabase/functions; un import a packages/shared saldria del directorio que se sube.
// Las expresiones de limpieza son las mismas que en errores.js: si se cambia una, se cambian las
// dos. Por la misma razon que alla, nada sale hacia Sentry sin pasar por limpiarDatosSensibles():
// un mensaje de Postgres puede copiar un correo o un DPI en su `detail`.

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const CORREO = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const DPI_CON_ESPACIOS = /\b\d{4}\s\d{5}\s\d{4}\b/g;
const TELEFONO_CON_GUION = /\b\d{4}-\d{4}\b/g;
const DIGITOS_LARGOS = /\b\d{8,}\b/g;
const DETALLE_DE_LLAVE = /(Key \([^)]*\)=\()[^)]*(\))/g;
const TOKEN_BEARER = /(bearer\s+)[A-Za-z0-9._-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

const DSN = /^(https?):\/\/([^@/]+)@([^/]+)((?:\/[^/]+)*)\/(\d+)\/?$/;

// Una corrida que cuelga esperando a Sentry retrasaria la respuesta de la funcion.
const ESPERA_MAXIMA_MS = 2000;

export function limpiarDatosSensibles(texto: unknown): string {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(JWT, "[token]")
    .replace(TOKEN_BEARER, "$1[token]")
    .replace(DETALLE_DE_LLAVE, "$1[valor]$2")
    .replace(UUID, "[id]")
    .replace(CORREO, "[correo]")
    .replace(DPI_CON_ESPACIOS, "[numero]")
    .replace(TELEFONO_CON_GUION, "[numero]")
    .replace(DIGITOS_LARGOS, "[numero]")
    .slice(0, 1000);
}

function mensajeDe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error ?? "Error desconocido");
}

export function urlDeEnvioDeSentry(dsn: string): string | null {
  const partes = DSN.exec(dsn.trim());
  if (!partes) return null;
  const [, protocolo, llave, host, prefijo, proyecto] = partes;
  return `${protocolo}://${host}${prefijo}/api/${proyecto}/envelope/?sentry_key=${
    encodeURIComponent(llave)
  }&sentry_version=7&sentry_client=ecopac-digital%2F1.0`;
}

function idDeEvento(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function construirEnvelope(funcion: string, contexto: string, error?: unknown): string {
  const eventId = idDeEvento();
  const valor = error === undefined ? contexto : `${contexto}: ${mensajeDe(error)}`;
  const evento = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    logger: "ecopac",
    environment: Deno.env.get("AMBIENTE") ?? "desconocido",
    exception: {
      values: [{
        type: error instanceof Error ? error.name : "Error",
        value: limpiarDatosSensibles(valor),
      }],
    },
    tags: { origen: "edge-function", funcion },
    extra: {
      pila: error instanceof Error ? limpiarDatosSensibles(error.stack ?? "") : "",
    },
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(evento),
  ].join("\n");
}

/**
 * Registra un error de una Edge Function en su log y, si hay SENTRY_DSN, en Sentry. Nunca lanza:
 * quien llama ya esta manejando un error y no puede fallar por avisarlo.
 *
 * @param funcion Nombre de la funcion ("invitar-usuario").
 * @param contexto Que se estaba haciendo ("fn_generar_alertas_caducidad fallo").
 */
export async function reportarErrorDeFuncion(
  funcion: string,
  contexto: string,
  error?: unknown,
  enviar: typeof fetch = fetch,
): Promise<void> {
  console.error(
    `${funcion}: ${contexto}`,
    error === undefined ? "" : limpiarDatosSensibles(mensajeDe(error)),
  );

  const dsn = Deno.env.get("SENTRY_DSN") ?? "";
  if (!dsn.trim()) return;

  const url = urlDeEnvioDeSentry(dsn);
  if (!url) {
    console.error(`${funcion}: SENTRY_DSN no tiene la forma https://<llave>@<host>/<proyecto>.`);
    return;
  }

  try {
    await enviar(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: construirEnvelope(funcion, contexto, error),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
  } catch {
    // Sentry caido o lento: el error ya quedo en el log de la funcion.
  }
}
