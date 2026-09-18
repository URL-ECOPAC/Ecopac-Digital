// De donde viene el presupuesto de una jornada (issue #840, bloque D; migracion 00132).
//
// jornadas.presupuesto_asignado dejo de escribirse a mano: es la suma de las filas de
// jornada_presupuesto_origen y la mantiene un trigger. Este archivo es la unica via de escritura
// de presupuesto que queda: se registra o se quita un aporte, nunca el total.
//
// asignarPresupuestoJornada() (api.js) escribia el total directo y se retiro con la 00132: la
// base ahora lo rechaza. Su guarda contra montos ilegibles (issue #597) se muda aqui, que es
// donde se sigue escribiendo dinero.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { ETIQUETAS_ORIGEN_PRESUPUESTO, ORIGENES_DE_PRESUPUESTO } from "../enums.js";
import { formatearFechaCorta } from "../formato/fechas.js";

const COLUMNAS_DEL_ORIGEN = [
  "id",
  "jornadaId:jornada_id",
  "origen",
  "donacionId:donacion_id",
  "monto",
  "descripcion",
  "registradoPor:registrado_por",
  "createdAt:created_at",
  "donacion:donaciones(fecha, donante:donantes(nombre))",
].join(", ");

/**
 * Convierte a numero para ESCRIBIR, o devuelve null si el valor no es un numero utilizable.
 *
 * Issue #597: `Number("")`, `Number(null)` y `Number("  ")` son 0, asi que un campo de
 * formulario vacio pasaba por un monto de cero y se escribia sin ninguna senal de que el dato
 * venia mal. Aqui un valor ilegible falla.
 *
 * @param {unknown} valor
 * @returns {number|null}
 */
export function aNumeroAEscribir(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" && valor.trim() === "") return null;

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function aOrigen(fila) {
  const donanteNombre = fila.donacion?.donante?.nombre ?? null;
  const fechaDonacion = fila.donacion?.fecha ?? null;
  // Lo que se lee en la lista: de que donacion salio, o el detalle que se escribio.
  const detalleDeDonacion = donanteNombre
    ? `${donanteNombre}${fechaDonacion ? `, ${formatearFechaCorta(fechaDonacion)}` : ""}`
    : null;
  return {
    ...fila,
    monto: Number(fila.monto),
    donanteNombre,
    fechaDonacion,
    etiqueta: ETIQUETAS_ORIGEN_PRESUPUESTO[fila.origen] ?? fila.origen,
    detalle: [detalleDeDonacion, fila.descripcion].filter(Boolean).join(" · ") || null,
  };
}

/**
 * Los aportes que forman el presupuesto de una jornada, del mas antiguo al mas reciente.
 *
 * @param {string} jornadaId
 * @returns {Promise<{ origenes: object[], error: object|null }>}
 */
export async function listarOrigenesDePresupuesto(jornadaId) {
  if (!jornadaId) return { origenes: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_presupuesto_origen")
      .select(COLUMNAS_DEL_ORIGEN)
      .eq("jornada_id", jornadaId)
      .order("created_at", { ascending: true });

    if (error) return { origenes: [], error: normalizarError(error) };
    return { origenes: (data ?? []).map(aOrigen), error: null };
  } catch (error) {
    return { origenes: [], error: normalizarError(error) };
  }
}

/**
 * Registra un aporte al presupuesto de una jornada. La base recalcula el total.
 *
 * Un monto ilegible o no positivo se rechaza aqui con el codigo de violacion de CHECK, sin llegar
 * al servidor: es lo mismo que haria chk_presupuesto_origen_monto_positivo, con un mensaje mas
 * temprano. Que una donacion no se asigne mas alla de su saldo lo decide la base
 * (fn_validar_origen_de_presupuesto), porque solo ella ve lo que ya asignaron las demas jornadas.
 *
 * @param {{ jornadaId: string, origen: string, donacionId?: string|null, monto: number|string,
 *   descripcion?: string|null }} datos
 * @returns {Promise<{ origen: object|null, error: object|null }>}
 */
export async function registrarOrigenDePresupuesto({
  jornadaId,
  origen,
  donacionId,
  monto,
  descripcion,
} = {}) {
  const cantidad = aNumeroAEscribir(monto);
  if (cantidad === null || cantidad <= 0) {
    return { origen: null, error: normalizarError({ code: "23514" }) };
  }
  if (!jornadaId || !origen) {
    return { origen: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_presupuesto_origen")
      .insert({
        jornada_id: jornadaId,
        origen,
        donacion_id: origen === ORIGENES_DE_PRESUPUESTO.DONACION ? donacionId || null : null,
        monto: cantidad,
        descripcion: descripcion?.trim() || null,
      })
      .select(COLUMNAS_DEL_ORIGEN)
      .single();

    if (error) return { origen: null, error: normalizarError(error) };
    return { origen: aOrigen(data), error: null };
  } catch (error) {
    return { origen: null, error: normalizarError(error) };
  }
}

/**
 * Quita un aporte. La base recalcula el total.
 *
 * @param {string} origenId
 * @returns {Promise<{ error: object|null }>}
 */
export async function quitarOrigenDePresupuesto(origenId) {
  if (!origenId) return { error: null };

  try {
    const { error } = await obtenerSupabase()
      .from("jornada_presupuesto_origen")
      .delete()
      .eq("id", origenId);

    return { error: error ? normalizarError(error) : null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}

/**
 * Suma de montos de filas que pueden traer el monto como cadena ("600.00"), que es como PostgREST
 * devuelve un NUMERIC.
 */
function sumarMontos(filas = []) {
  return filas.reduce((suma, fila) => suma + (Number(fila.monto) || 0), 0);
}

/**
 * Lo que queda por asignar de una donacion: su total menos lo que ya se asigno en cualquier
 * jornada. Pura y exportada para probarla sin base.
 *
 * @param {{ donacion_detalle?: {monto: unknown}[], jornada_presupuesto_origen?: {monto: unknown}[] }} fila
 * @returns {{ total: number, asignado: number, disponible: number }}
 */
export function saldoDeDonacion(fila) {
  const total = sumarMontos(fila?.donacion_detalle);
  const asignado = sumarMontos(fila?.jornada_presupuesto_origen);
  // Redondeo a centavos: sumar decimales en coma flotante deja restos como 0.0000001.
  const disponible = Math.round((total - asignado) * 100) / 100;
  return { total, asignado, disponible };
}

/**
 * Donaciones de dinero registradas que todavia tienen saldo sin asignar a ninguna jornada. Es el
 * catalogo del que se elige un origen "donacion" sin volver a teclear el monto (issue #840).
 *
 * Si se pasa `proyectoId`, las del proyecto de la jornada van primero: una donacion asignada a
 * un proyecto es la candidata natural para financiar sus jornadas.
 *
 * @param {{ proyectoId?: string|null }} [opciones]
 * @returns {Promise<{ donaciones: { id: string, fecha: string, donanteNombre: string|null,
 *   proyectoId: string|null, total: number, asignado: number, disponible: number }[],
 *   error: object|null }>}
 */
export async function listarDonacionesConSaldo({ proyectoId } = {}) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("donaciones")
      .select(
        "id, fecha, proyecto_id, donante:donantes(nombre), donacion_detalle(monto), jornada_presupuesto_origen(monto)",
      )
      .eq("tipo", "dinero")
      .eq("estado", "registrada")
      .order("fecha", { ascending: false });

    if (error) return { donaciones: [], error: normalizarError(error) };

    const donaciones = (data ?? [])
      .map((fila) => ({
        id: fila.id,
        fecha: fila.fecha,
        donanteNombre: fila.donante?.nombre ?? null,
        proyectoId: fila.proyecto_id ?? null,
        ...saldoDeDonacion(fila),
      }))
      .filter((donacion) => donacion.disponible > 0)
      .sort((a, b) => {
        if (!proyectoId) return 0;
        return Number(b.proyectoId === proyectoId) - Number(a.proyectoId === proyectoId);
      });

    return { donaciones, error: null };
  } catch (error) {
    return { donaciones: [], error: normalizarError(error) };
  }
}
