// Consultas de Supabase de las alertas de medicamentos proximos a vencer (issue #151, RF-19).
//
// Este archivo es el unico lugar del monorepo que lee y escribe alertas_caducidad. Las filas
// las genera una rutina programada (supabase/functions, issue #166), no un rol de aplicacion:
// aqui solo se listan y se cierran.
//
// Todas las funciones devuelven { alerta(s), error } en vez de lanzar, igual que supabase-js:
// quien las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el
// render.
//
// atenderAlerta() si valida el rol aqui (a diferencia de lotes.api.js, que deja esa decision
// por completo a RLS): es una accion de cierre con auditoria, no una operacion de catalogo, y
// es el mismo criterio que ya usan aprobarMovimiento()/rechazarMovimiento()
// (inventario/validacion.api.js) y aprobarGasto()/rechazarGasto() (presupuestos). El servidor
// sigue siendo quien de verdad decide: fn_atender_alerta_caducidad (00138) lanza 42501 a cualquier
// otro rol, y desde esa migracion nadie tiene UPDATE directo sobre alertas_caducidad.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { ACCIONES_DE_ALERTA, ESTADOS_ALERTA } from "../enums.js";
import { diasHastaVencimiento } from "../formato/fechas.js";
import { esAdministrador } from "../usuarios/roles.js";

// accion_alerta (00021) se declara en enums.js, no aqui: era la tercera copia de los mismos
// tres valores -las otras dos en campos.js y en useGestionLotes.js- y nada obligaba a que
// coincidieran (issue #397).
const ACCIONES_VALIDAS = Object.values(ACCIONES_DE_ALERTA);

// lote y medicamento se piden embebidos (solo lo que hace falta para pintar la alerta) para no
// necesitar una segunda consulta por fila.
const COLUMNAS_DE_LA_ALERTA = [
  "id",
  "loteId:lote_id",
  "estado",
  "cantidadAfectada:cantidad_afectada",
  "accion",
  // Una alerta pendiente no los tiene; los dibuja el bloque "Atendidas recientemente" del panel
  // web, que lee historialAlertas() (issue #755).
  "atendidaPor:atendida_por",
  "atendidaEn:atendida_en",
  "createdAt:created_at",
  "updatedAt:updated_at",
  "lote:lotes(numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, medicamento:medicamentos(nombre))",
].join(", ");

/**
 * Traduce una fila de alertas_caducidad (con lote/medicamento embebidos) a una alerta, agregando
 * diasRestantes -calculado aqui y no en la pantalla, mismo criterio que lotes.api.js con
 * `vencido`- para que web y movil nunca discrepen sobre cuantos dias faltan.
 */
function aAlerta(fila) {
  if (!fila) return null;

  const fechaVencimiento = fila.lote?.fechaVencimiento ?? null;

  return {
    id: fila.id,
    loteId: fila.loteId,
    medicamento: fila.lote?.medicamento?.nombre ?? null,
    numeroLote: fila.lote?.numeroLote ?? null,
    fechaVencimiento,
    diasRestantes: diasHastaVencimiento(fechaVencimiento),
    estado: fila.estado,
    cantidadAfectada: fila.cantidadAfectada,
    accion: fila.accion,
    atendidaPor: fila.atendidaPor,
    atendidaPorNombre: fila.atendidaPorPerfil
      ? `${fila.atendidaPorPerfil.nombres} ${fila.atendidaPorPerfil.apellidos}`.trim()
      : null,
    atendidaEn: fila.atendidaEn,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

/**
 * Alertas pendientes, la mas urgente primero.
 *
 * El orden se resuelve en el cliente sobre diasRestantes ya calculado, no con .order() de
 * PostgREST sobre la columna embebida lotes.fecha_vencimiento: la sintaxis para ordenar por una
 * tabla referenciada depende de la version de postgrest-js, y esto evita depender de un detalle
 * que no se pudo verificar contra una base real.
 *
 * @returns {Promise<{ alertas: object[], error: object|null }>}
 */
/**
 * Pone al dia alertas_caducidad antes de listarla, sin esperar a la rutina programada.
 *
 * Existe por la issue #838: un lote ya vencido no tenia alerta -- fn_generar_alertas_caducidad()
 * lo descartaba por vencido hasta la migracion 00129 -- asi que el bloque "Vencidos - Para dar de
 * baja" salia vacio aunque el inventario mostrara el lote. Corregida la funcion, la fila igual
 * tardaba hasta la corrida siguiente en aparecer; esto la adelanta.
 *
 * Solo la administradora puede: fn_sincronizar_alertas_caducidad() lo comprueba y devuelve 42501
 * a cualquier otro rol. Quien llama trata ese error como "no habia nada que sincronizar", no como
 * un fallo de la pantalla: el resto del panel se lee igual sin este paso.
 *
 * @returns {Promise<{ creadas: number, error: object|null }>}
 */
export async function sincronizarAlertas() {
  try {
    const { data, error } = await obtenerSupabase().rpc("fn_sincronizar_alertas_caducidad");
    if (error) return { creadas: 0, error: normalizarError(error) };
    return { creadas: Number(data) || 0, error: null };
  } catch (error) {
    return { creadas: 0, error: normalizarError(error) };
  }
}

export async function listarAlertas() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("alertas_caducidad")
      .select(COLUMNAS_DE_LA_ALERTA)
      .eq("estado", ESTADOS_ALERTA.PENDIENTE);

    if (error) return { alertas: [], error: normalizarError(error) };

    const alertas = (data ?? []).map(aAlerta);
    alertas.sort((a, b) => (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity));
    return { alertas, error: null };
  } catch (error) {
    return { alertas: [], error: normalizarError(error) };
  }
}

// Quien la atendio, por nombre: atendida_por es un uuid que no le dice nada a quien lee el panel.
// La FK se nombra porque alertas_caducidad no tiene otra relacion con perfiles, pero dejarla
// explicita evita que una segunda FK futura vuelva ambiguo el embebido. Si RLS no deja leer ese
// perfil, el embebido llega en null y la pantalla muestra el guion, no un error.
const COLUMNAS_DEL_HISTORIAL = `${COLUMNAS_DE_LA_ALERTA}, atendidaPorPerfil:perfiles!alertas_caducidad_atendida_por_fkey(nombres, apellidos)`;

/**
 * Historial de alertas ya atendidas, la mas reciente primero. `limite` acota la consulta: el
 * panel solo muestra las recientes, y el historial crece con cada alerta cerrada.
 *
 * @param {{ limite?: number }} [opciones]
 * @returns {Promise<{ alertas: object[], error: object|null }>}
 */
export async function historialAlertas({ limite = 20 } = {}) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("alertas_caducidad")
      .select(COLUMNAS_DEL_HISTORIAL)
      .eq("estado", ESTADOS_ALERTA.ATENDIDA)
      .order("atendida_en", { ascending: false })
      .limit(limite);

    if (error) return { alertas: [], error: normalizarError(error) };
    return { alertas: (data ?? []).map(aAlerta), error: null };
  } catch (error) {
    return { alertas: [], error: normalizarError(error) };
  }
}

/**
 * Atiende una alerta pendiente: la cierra y ejecuta la accion sobre el stock, todo en
 * fn_atender_alerta_caducidad (migracion 00138, issue #755). Hasta esa migracion era un UPDATE de
 * la alerta y nada mas: las unidades seguian en existencias y el generador volvia a crear la alerta
 * -con su notificacion y su correo- en cuanto el panel recargaba.
 *
 *   - descartado / donado: da de baja todo el stock del lote (salidas aprobadas en el Kardex).
 *   - reubicado: traslada el stock a `bodegaDestinoId`; solo para un lote que no vencio.
 *
 * Quien atiende lo decide la base (auth.uid()), no un parametro: por eso aqui no viaja usuarioId.
 *
 * @param {string} idAlerta
 * @param {{ accion: string, rolUsuario: string, bodegaDestinoId?: string }} datos
 * @returns {Promise<{ alerta: object|null, error: object|null }>}
 */
export async function atenderAlerta(idAlerta, { accion, rolUsuario, bodegaDestinoId } = {}) {
  if (!esAdministrador(rolUsuario)) {
    return {
      alerta: null,
      error: { mensaje: "Solo administración puede atender una alerta de vencimiento." },
    };
  }

  if (!ACCIONES_VALIDAS.includes(accion)) {
    return {
      alerta: null,
      error: construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
        `La accion tomada es obligatoria y debe ser una de: ${ACCIONES_VALIDAS.join(", ")}.`,
      ),
    };
  }

  if (requiereBodegaDestino(accion) && !bodegaDestinoId) {
    return {
      alerta: null,
      error: construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
        "Para reubicar hay que elegir la bodega destino.",
      ),
    };
  }

  try {
    const cliente = obtenerSupabase();
    const { error } = await cliente.rpc("fn_atender_alerta_caducidad", {
      p_alerta_id: idAlerta,
      p_accion: accion,
      p_bodega_destino_id: requiereBodegaDestino(accion) ? bodegaDestinoId : null,
    });
    if (error) return { alerta: null, error: normalizarError(error) };

    const { data, error: errorAlLeer } = await cliente
      .from("alertas_caducidad")
      .select(COLUMNAS_DE_LA_ALERTA)
      .eq("id", idAlerta)
      .single();

    if (errorAlLeer) return { alerta: null, error: normalizarError(errorAlLeer) };
    return { alerta: aAlerta(data), error: null };
  } catch (error) {
    return { alerta: null, error: normalizarError(error) };
  }
}

/** Reubicar es la unica accion que traslada en vez de dar de baja: necesita bodega destino. */
export function requiereBodegaDestino(accion) {
  return accion === ACCIONES_DE_ALERTA.REUBICADO;
}

/**
 * Acciones que se ofrecen para una alerta. Un lote vencido no se reubica -no se puede entregar
 * (00044) y trasladarlo no lo resuelve-, asi que para el solo quedan descartado y donado. Es la
 * misma regla que fn_atender_alerta_caducidad aplica en la base.
 *
 * @param {{ diasRestantes: number|null }} alerta
 * @param {{ value: string, label: string }[]} opciones Normalmente OPCIONES_ACCION_ALERTA.
 */
export function accionesPermitidasParaAlerta(alerta, opciones) {
  const vencida = (alerta?.diasRestantes ?? 0) < 0;
  return vencida ? opciones.filter((o) => !requiereBodegaDestino(o.value)) : opciones;
}

/**
 * Lo que va a pasar con el stock al confirmar, para decirlo antes de que ocurra.
 *
 * @param {string} accion
 * @param {number} cantidad Unidades afectadas por la alerta.
 */
export function efectoDeAccionSobreElStock(accion, cantidad) {
  if (!ACCIONES_VALIDAS.includes(accion)) return null;
  if (requiereBodegaDestino(accion)) {
    return `Las ${cantidad} unidades del lote se trasladan a la bodega destino.`;
  }
  return `Se dan de baja las ${cantidad} unidades del lote en todas las bodegas. Queda registrado en el Kardex.`;
}
