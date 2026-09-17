// Reporte centralizado de errores (issue #762, "monitoreo de errores").
//
// EL PROBLEMA. No habia ningun sitio por donde pasaran los errores: cada pantalla hacia su
// console.error, o nada. Asi es como `keep-alive-supabase.yml` estuvo un mes en verde con cada ping
// fallando, y como una entrega de medicamentos mostraba "no hay nada que entregar" en vez de un
// error. Antes de elegir una herramienta de monitoreo hace falta un unico punto por el que pase
// todo, para que conectarla sea cambiar un destino y no recorrer cien `catch`.
//
// LA RESTRICCION. AGENTS.md prohibe datos reales de pacientes en logs, y las rutas llevan el UUID
// del paciente (/pacientes/:id). Un error que se reporta tal cual puede llevar dentro un nombre, un
// DPI, un telefono o un correo -en el mensaje de Postgres, en la URL, en el `detail` de una
// violacion de UNIQUE-. Por eso NADA sale de aqui sin pasar por `limpiarDatosSensibles`, y el
// destino por defecto es la consola, que no sale del equipo.
//
// Este archivo no toca window, document ni ningun SDK: es JS puro. La plataforma engancha los
// errores globales que solo ella puede ver (apps/web/src/main.jsx y LimiteDeError.jsx) y, cuando se
// elija la herramienta de monitoreo, le dice a donde enviarlos con `configurarDestinoDeErrores`.
// Hasta entonces el destino es la consola: ver docs/SEGURIDAD.md, "Observabilidad".

import { sanearDetalle } from "../api/errores-de-supabase.js";

// POR QUE NO BASTA CON sanearDetalle(). Esa funcion (api/errores-de-supabase.js) ya existia y se
// sigue usando aqui para el `detail` de Postgres, que es su caso: reemplaza TODO lo que va entre
// parentesis y comillas. Aplicada a un mensaje de JavaScript o a una pila la dejaria ilegible
// -"Cannot read properties of undefined (reading 'nombre')" pierde justo lo que dice que fallo-, y
// sin embargo dejaria pasar un correo o un UUID que no vayan entrecomillados, como el de una ruta.
// Por eso el mensaje, la pila y la ruta pasan por limpiarDatosSensibles(), que busca los datos por
// su forma y deja el resto del texto intacto.

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const CORREO = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// DPI guatemalteco (13 digitos, con o sin espacios en grupos 4-5-4) y cualquier corrida de 8 o
// mas digitos: telefonos, numeros de documento, correlativos que identifican a alguien.
const DPI_CON_ESPACIOS = /\b\d{4}\s\d{5}\s\d{4}\b/g;
const TELEFONO_CON_GUION = /\b\d{4}-\d{4}\b/g;
const DIGITOS_LARGOS = /\b\d{8,}\b/g;
// El `detail` de Postgres en una violacion de unicidad o de llave foranea copia el valor:
//   Key (dpi)=(1234567890101) already exists.
const DETALLE_DE_LLAVE = /(Key \([^)]*\)=\()[^)]*(\))/g;
// Tokens que no deberian llegar nunca a un mensaje, pero si llegan no salen.
const TOKEN_BEARER = /(bearer\s+)[A-Za-z0-9._-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

const LONGITUD_MAXIMA_DE_TEXTO = 1000;

/**
 * Quita de un texto lo que podria identificar a una persona o dar acceso: UUID, correos, DPI,
 * telefonos, corridas largas de digitos, valores copiados en el `detail` de Postgres y tokens.
 *
 * Prefiere quitar de mas: un reporte con "[id]" donde habia un UUID de lote se sigue pudiendo
 * investigar; un DPI que llego a un servicio externo ya no se puede recuperar.
 *
 * @param {unknown} texto
 * @returns {string}
 */
export function limpiarDatosSensibles(texto) {
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
    .slice(0, LONGITUD_MAXIMA_DE_TEXTO);
}

/**
 * Convierte cualquier cosa que se haya lanzado -un Error, el `{ mensaje, codigo }` normalizado de
 * las APIs de este paquete, el `{ message, code }` de supabase-js, un string- en un reporte plano y
 * ya limpio. Nunca lanza.
 *
 * @param {unknown} error
 * @param {object} [contexto]
 * @param {string} [contexto.origen] Donde se capturo: "pantalla", "promesa-sin-capturar", ...
 * @param {string} [contexto.ruta] La ruta de la pantalla. Se limpia como cualquier otro texto.
 * @param {string} [contexto.modulo] Modulo funcional ("inventario", "pacientes"...).
 * @param {string} [contexto.pilaDeComponentes] La pila de componentes de React, si la hay.
 * @returns {{ mensaje: string, nombre: string, codigo: string|null, pila: string, detalle: string,
 *   pilaDeComponentes: string, origen: string, ruta: string, modulo: string|null,
 *   momento: string }}
 */
export function construirReporteDeError(error, contexto = {}) {
  const esObjeto = error !== null && typeof error === "object";
  const mensajeCrudo = esObjeto
    ? (error.mensaje ?? error.message ?? safeJson(error))
    : String(error ?? "Error desconocido");
  const codigo = esObjeto ? (error.codigo ?? error.code ?? null) : null;

  return {
    mensaje: limpiarDatosSensibles(mensajeCrudo) || "Error desconocido",
    nombre: esObjeto && typeof error.name === "string" ? error.name : "Error",
    codigo: codigo === null ? null : limpiarDatosSensibles(codigo),
    pila: esObjeto && typeof error.stack === "string" ? limpiarDatosSensibles(error.stack) : "",
    detalle: esObjeto ? limpiarDatosSensibles(sanearDetalle(error.detalle ?? error.details)) : "",
    pilaDeComponentes: limpiarDatosSensibles(contexto.pilaDeComponentes ?? ""),
    origen: contexto.origen ?? "desconocido",
    ruta: limpiarDatosSensibles(contexto.ruta ?? ""),
    modulo: contexto.modulo ?? null,
    momento: new Date().toISOString(),
  };
}

function safeJson(valor) {
  try {
    return JSON.stringify(valor);
  } catch {
    return "Error no serializable";
  }
}

/** Destino por defecto: la consola del equipo. No sale de el. */
function destinoConsola(reporte) {
  console.error(`[ecopac] ${reporte.origen}: ${reporte.mensaje}`, reporte);
}

let destinoActual = destinoConsola;

/**
 * Cambia a donde van los reportes. Es el unico punto que hay que tocar para conectar una
 * herramienta de monitoreo: recibe el reporte ya limpio.
 *
 * @param {((reporte: ReturnType<typeof construirReporteDeError>) => void) | null} destino
 *   `null` vuelve a la consola.
 */
export function configurarDestinoDeErrores(destino) {
  destinoActual = typeof destino === "function" ? destino : destinoConsola;
}

/**
 * Reporta un error. Nunca lanza: un fallo del propio reporte no puede tumbar la pantalla que
 * estaba intentando avisar de otro.
 *
 * @param {unknown} error
 * @param {Parameters<typeof construirReporteDeError>[1]} [contexto]
 * @returns {ReturnType<typeof construirReporteDeError>} El reporte que se envio.
 */
export function reportarError(error, contexto) {
  const reporte = construirReporteDeError(error, contexto);
  try {
    destinoActual(reporte);
  } catch {
    // El destino fallo (red caida, SDK sin configurar). Se cae a la consola una vez; si tambien
    // falla, no hay a donde mas avisar.
    try {
      destinoConsola(reporte);
    } catch {
      // Sin consola disponible no queda ningun canal.
    }
  }
  return reporte;
}
