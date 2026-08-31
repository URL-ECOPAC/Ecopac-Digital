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
// sigue siendo quien de verdad decide: la politica "Solo administrador atiende alertas_caducidad"
// (00034) rechaza con 42501 cualquier intento que se salte este chequeo.

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

/**
 * Historial de alertas ya atendidas, la mas reciente primero.
 *
 * @returns {Promise<{ alertas: object[], error: object|null }>}
 */
export async function historialAlertas() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("alertas_caducidad")
      .select(COLUMNAS_DE_LA_ALERTA)
      .eq("estado", ESTADOS_ALERTA.ATENDIDA)
      .order("atendida_en", { ascending: false });

    if (error) return { alertas: [], error: normalizarError(error) };
    return { alertas: (data ?? []).map(aAlerta), error: null };
  } catch (error) {
    return { alertas: [], error: normalizarError(error) };
  }
}

/**
 * Cierra una alerta pendiente registrando la accion tomada. Exige accion (uno de
 * ACCIONES_DE_ALERTA) y usuarioId; el CHECK chk_alertas_caducidad_cierre_coherente (00021) exige
 * ademas que viajen junto con estado = 'atendida', asi que esa coherencia no se duplica aqui.
 *
 * @param {string} idAlerta
 * @param {{ accion: string, usuarioId: string, rolUsuario: string }} datos
 * @returns {Promise<{ alerta: object|null, error: object|null }>}
 */
export async function atenderAlerta(idAlerta, { accion, usuarioId, rolUsuario } = {}) {
  if (!esAdministrador(rolUsuario)) {
    return {
      alerta: null,
      error: { mensaje: "Solo administracion puede atender una alerta de vencimiento." },
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

  if (!usuarioId) {
    return {
      alerta: null,
      error: construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
        "Se requiere el usuario que atiende la alerta.",
      ),
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("alertas_caducidad")
      .update({
        estado: ESTADOS_ALERTA.ATENDIDA,
        accion,
        atendida_por: usuarioId,
        atendida_en: new Date().toISOString(),
      })
      .eq("id", idAlerta)
      .select(COLUMNAS_DE_LA_ALERTA)
      .single();

    if (error) return { alerta: null, error: normalizarError(error) };
    return { alerta: aAlerta(data), error: null };
  } catch (error) {
    return { alerta: null, error: normalizarError(error) };
  }
}
