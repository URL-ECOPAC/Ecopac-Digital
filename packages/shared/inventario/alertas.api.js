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
// sigue siendo quien de verdad decide: fn_atender_alerta_caducidad (00138, extendida por 00143
// para aceptar varias acciones) lanza 42501 a cualquier otro rol, y desde la 00138 nadie tiene
// UPDATE directo sobre alertas_caducidad.

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
  // existencias(cantidadDisponible) embebida (issue #859): cantidadAfectada queda congelada al
  // generar la alerta (arriba), y una salida registrada por fuera de "Atender" -entrega,
  // traslado, baja manual- reduce existencias sin tocar esa columna ni la fila de la alerta, que
  // sigue pendiente. Sin esto la pantalla seguia mostrando el total original aunque ya no quedara
  // esa cantidad, y confirmar "Atender" con ese total lo rechazaba fn_atender_alerta_caducidad
  // (00143), que valida contra el disponible VIVO -la misma suma que se hace aqui, en
  // aAlerta()-, no contra cantidad_afectada.
  "lote:lotes(numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, medicamento:medicamentos(nombre), existencias(cantidadDisponible:cantidad_disponible))",
  // Vacio en una alerta pendiente (no hay filas todavia); en una atendida con una sola accion
  // coincide con `accion`, y con varias es donde vive el desglose completo (00143, PLAN.md
  // punto 5): `accion` en la fila de arriba queda NULL en ese caso.
  "detalle:alerta_caducidad_detalle(accion, cantidad, bodegaDestinoId:bodega_destino_id)",
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
    // cantidadAfectada: instantanea del momento en que se genero la alerta, para auditoria.
    // cantidadDisponible: lo que de verdad queda HOY en el lote -misma suma que hace el servidor
    // en fn_atender_alerta_caducidad (00143)-, para pintar y para armar el total a repartir al
    // atender. Las dos pueden divergir en cuanto alguien registra una salida del lote por fuera
    // de "Atender".
    cantidadAfectada: fila.cantidadAfectada,
    cantidadDisponible: (fila.lote?.existencias ?? []).reduce(
      (total, existencia) => total + (Number(existencia.cantidadDisponible) || 0),
      0,
    ),
    accion: fila.accion,
    detalle: (fila.detalle ?? []).map((item) => ({
      accion: item.accion,
      cantidad: item.cantidad,
      bodegaDestinoId: item.bodegaDestinoId,
    })),
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

/**
 * Lista las alertas de caducidad pendientes, de la que vence antes a la que vence despues.
 *
 * @returns {Promise<{ alertas: object[], error: object|null }>} `alertas` vacia si hubo error.
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

/** Reubicar es la unica accion que traslada en vez de dar de baja: necesita bodega destino. */
export function requiereBodegaDestino(accion) {
  return accion === ACCIONES_DE_ALERTA.REUBICADO;
}

/**
 * Valida una lista de acciones antes de mandarla al servidor (PLAN.md punto 5): cada una con
 * accion conocida y cantidad mayor a cero, reubicado con bodegaDestinoId, y la suma EXACTAMENTE
 * igual a `totalDisponible` -- ni de mas ni de menos. fn_atender_alerta_caducidad (00143) valida
 * lo mismo contra el disponible vivo del lote; esto solo adelanta el mensaje sin esperar el viaje
 * de ida y vuelta al servidor.
 *
 * @param {{accion:string, cantidad:number, bodegaDestinoId?:string}[]} acciones
 * @param {number} totalDisponible
 * @returns {string|null} Mensaje de error, o null si esta todo bien.
 */
export function validarAccionesDeAlerta(acciones, totalDisponible) {
  if (!Array.isArray(acciones) || acciones.length === 0) {
    return "Hay que indicar al menos una acción.";
  }

  let suma = 0;
  for (const item of acciones) {
    if (!ACCIONES_VALIDAS.includes(item?.accion)) {
      return `La acción debe ser una de: ${ACCIONES_VALIDAS.join(", ")}.`;
    }
    if (!(Number(item.cantidad) > 0)) {
      return "La cantidad de cada acción debe ser mayor a cero.";
    }
    if (requiereBodegaDestino(item.accion) && !item.bodegaDestinoId) {
      return "Para reubicar hay que elegir la bodega destino.";
    }
    suma += Number(item.cantidad);
  }

  if (suma !== Number(totalDisponible)) {
    return `Las acciones tienen que sumar exactamente ${totalDisponible} unidades (llevan ${suma}).`;
  }

  return null;
}

/**
 * Atiende una alerta pendiente: la cierra y ejecuta una o mas acciones sobre el stock, todo en
 * fn_atender_alerta_caducidad (migracion 00143, PLAN.md punto 5). Hasta esa migracion una alerta
 * solo se podia atender con UNA accion sobre TODO el lote; ahora `acciones` es una lista de
 * { accion, cantidad, bodegaDestinoId? } cuyas cantidades tienen que sumar exactamente
 * `totalDisponible` -- el disponible VIVO del lote al momento de atender, no `cantidadAfectada`
 * (el numero que quedo congelado al generar la alerta).
 *
 *   - descartado / donado: da de baja esa cantidad (salidas aprobadas en el Kardex).
 *   - reubicado: traslada esa cantidad a `bodegaDestinoId`; solo para un lote que no vencio.
 *
 * Quien atiende lo decide la base (auth.uid()), no un parametro: por eso aqui no viaja usuarioId.
 *
 * @param {string} idAlerta
 * @param {{ acciones: {accion:string, cantidad:number, bodegaDestinoId?:string}[],
 *   rolUsuario: string, totalDisponible: number }} datos
 * @returns {Promise<{ alerta: object|null, error: object|null }>}
 */
export async function atenderAlerta(idAlerta, { acciones, rolUsuario, totalDisponible } = {}) {
  if (!esAdministrador(rolUsuario)) {
    return {
      alerta: null,
      error: { mensaje: "Solo administración puede atender una alerta de vencimiento." },
    };
  }

  const errorDeValidacion = validarAccionesDeAlerta(acciones, totalDisponible);
  if (errorDeValidacion) {
    return {
      alerta: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO, errorDeValidacion),
    };
  }

  try {
    const cliente = obtenerSupabase();
    const { error } = await cliente.rpc("fn_atender_alerta_caducidad", {
      p_alerta_id: idAlerta,
      p_acciones: acciones.map((item) => ({
        accion: item.accion,
        cantidad: Number(item.cantidad),
        bodegaDestinoId: requiereBodegaDestino(item.accion) ? item.bodegaDestinoId : null,
      })),
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
    return `${cantidad} unidades del lote se trasladan a la bodega destino.`;
  }
  return `Se dan de baja ${cantidad} unidades del lote. Queda registrado en el Kardex.`;
}
