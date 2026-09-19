// Consultas de Supabase de los lotes de medicamentos.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, como indica el encabezado de api/index.js. Este archivo es el unico
// lugar del monorepo que lee y escribe la tabla lotes. Se llama lotes.api.js y no api.js por el
// mismo motivo que medicamentos.api.js: inventario/ lo construye mas de una issue en paralelo
// (medicamentos, movimientos...); un api.js unico seria un iman de conflictos.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
//
// Ninguna funcion valida aqui quien puede crear un lote: esa regla la aplican las politicas de
// 00034_politicas_rls_inventario.sql (INSERT/UPDATE solo administrador, SELECT abierto a
// autenticados), y un intento sin permiso vuelve como error 42501, que normalizarError() ya
// traduce. El cliente pregunta para dibujar, el servidor decide.
//
// vencido no se calcula en cada pantalla (nota tecnica de la issue, RF-14): sale de
// diasHastaVencimiento() de packages/shared/formato/fechas.js, la misma utilidad que ya usan
// pacientes y reportes para calendario, aplicada una sola vez aqui al mapear cada fila.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { diasHastaVencimiento } from "../formato/fechas.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva no empiece a viajar
// sola hasta el cliente. medicamento y proveedor se piden embebidos (solo el nombre) para que la
// pantalla pinte el listado sin una segunda consulta; los ids propios (medicamentoId,
// proveedorId) siempre viajan tambien.
const COLUMNAS_DEL_LOTE = [
  "id",
  "medicamentoId:medicamento_id",
  "numeroLote:numero_lote",
  "proveedorId:proveedor_id",
  "origen",
  "cantidadIngresada:cantidad_ingresada",
  "fechaIngreso:fecha_ingreso",
  "fechaVencimiento:fecha_vencimiento",
  "costoUnitario:costo_unitario",
  "moneda",
  "registradoPor:registrado_por",
  "confirmado",
  "createdAt:created_at",
  "updatedAt:updated_at",
  "medicamento:medicamentos(nombre)",
  "proveedor:proveedores(nombre)",
].join(", ");

// Aqui vivian CAMPOS_REQUERIDOS_DE_LOTE y faltaAlgunCampoRequerido(), que solo servian a
// registrarLote(). Salieron con el: ver la nota de la issue #846 mas abajo.

/** Traduce del camelCase de las pantallas al snake_case de la tabla lotes. */
function aColumnasDeTabla(datos = {}) {
  const mapa = {
    medicamento: "medicamento_id",
    numeroLote: "numero_lote",
    proveedor: "proveedor_id",
    origen: "origen",
    cantidadIngresada: "cantidad_ingresada",
    fechaIngreso: "fecha_ingreso",
    fechaVencimiento: "fecha_vencimiento",
    costoUnitario: "costo_unitario",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Traduce una fila de lotes (con medicamento/proveedor embebidos) a un lote, agregando
 * `vencido`: true cuando fechaVencimiento ya paso, calculado aqui y no en la pantalla (RF-14).
 *
 * `costoUnitario` (issue #752) llega `null` cuando no se conoce -un lote donado, o uno de compra
 * sin precio capturado- y nunca se convierte a 0: forzar un cero mentiria en los reportes
 * financieros igual que forzar un precio inventado (00121).
 */
function aLote(fila) {
  if (!fila) return null;

  return {
    id: fila.id,
    medicamentoId: fila.medicamentoId,
    medicamento: fila.medicamento?.nombre ?? null,
    numeroLote: fila.numeroLote,
    proveedorId: fila.proveedorId,
    proveedor: fila.proveedor?.nombre ?? null,
    origen: fila.origen,
    cantidadIngresada: fila.cantidadIngresada,
    fechaIngreso: fila.fechaIngreso,
    fechaVencimiento: fila.fechaVencimiento,
    costoUnitario:
      fila.costoUnitario === null || fila.costoUnitario === undefined
        ? null
        : Number(fila.costoUnitario),
    moneda: fila.moneda ?? null,
    registradoPor: fila.registradoPor ?? null,
    confirmado: fila.confirmado ?? null,
    vencido: (diasHastaVencimiento(fila.fechaVencimiento) ?? 0) < 0,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

// AQUI ESTABA registrarLote(), y ya no hay ninguna forma de crear un lote suelto (issue #846).
//
// Insertaba en `lotes` y nada mas. El stock por bodega vive en `existencias` y solo nace de un
// movimiento de ingreso, asi que el lote quedaba creado y con cero existencias en todas partes:
// aparecia en la tabla de lotes como si tuviera medicamento, cantidad ingresada y vencimiento,
// pero no se podia despachar de ninguna bodega. Hasta la #840 el modal pedia ademas una "Bodega
// destino" obligatoria que la funcion descartaba, lo que lo hacia parecer un ingreso completo.
//
// El unico camino para dar de alta un lote es registrarIngreso() (movimientos.api.js), que crea
// el lote y su movimiento en la misma operacion. Un lote sin existencias no es un estado que
// nadie pidiera representar; que se pudiera crear era un efecto de tener dos caminos.
//
// Lo que queda de `lotes` se lee (listarLotes, obtenerLote) y se corrige (actualizarLote).

/**
 * Corrige un lote ya registrado (issue #752): un costo unitario mal escrito no puede quedar
 * congelado, igual que el telefono de un paciente (#699). Hoy es la unica correccion real que
 * pide una pantalla -CAMPOS_CORRECCION_LOTE (campos.js) solo declara costoUnitario-, pero la
 * funcion queda genérica (mismo patron que actualizarConsulta()/actualizarProyecto()) por si
 * algun dia hace falta corregir algo mas.
 *
 * Quien puede corregir lo decide la politica RLS de UPDATE (00107): la administradora siempre,
 * o el autor del lote mientras siga `confirmado = false`. Un intento fuera de esas dos
 * condiciones vuelve como 42501, que normalizarError() ya traduce.
 *
 * @param {string} id UUID del lote.
 * @param {{ costoUnitario?: number|null }} datos Campos en camelCase, subconjunto de CAMPOS_LOTE.
 * @returns {Promise<{ lote: object|null, error: object|null }>}
 */
export async function actualizarLote(id, datos = {}) {
  if (!id) {
    return { lote: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  const fila = aColumnasDeTabla(datos);
  if (Object.keys(fila).length === 0) {
    return { lote: null, error: null };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("lotes")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_LOTE)
      .maybeSingle();

    if (error) return { lote: null, error: normalizarError(error) };
    return { lote: aLote(data), error: null };
  } catch (error) {
    return { lote: null, error: normalizarError(error) };
  }
}

/**
 * Lista los lotes, opcionalmente filtrados, siempre ordenados por fecha de vencimiento (el mas
 * proximo a vencer primero): es el orden que importa para decidir que lote despachar primero, y
 * satisface por igual los dos criterios de consulta de la issue -lotes de un medicamento, y
 * lotes que vencen dentro de un rango de fechas- sin dos funciones casi identicas.
 *
 * Un filtro ausente o nulo no se aplica, para que la pantalla pueda pasar su estado de filtros
 * tal cual sin ir limpiando claves vacias. `fechaDesde`/`fechaHasta` son el rango de
 * fecha_vencimiento (FILTROS_LOTES.fechaVencimiento en filtros.js); cualquiera de los dos puede
 * venir solo.
 *
 * @param {{ busqueda?: string, medicamento?: string, proveedor?: string, fechaDesde?: string,
 *   fechaHasta?: string }} [filtros]
 * @returns {Promise<{ lotes: object[], error: object|null }>}
 */
export async function listarLotes({
  busqueda,
  medicamento,
  proveedor,
  fechaDesde,
  fechaHasta,
} = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("lotes")
      .select(COLUMNAS_DEL_LOTE)
      .order("fecha_vencimiento", { ascending: true });

    if (busqueda) consulta = consulta.ilike("numero_lote", `%${busqueda}%`);
    if (medicamento) consulta = consulta.eq("medicamento_id", medicamento);
    if (proveedor) consulta = consulta.eq("proveedor_id", proveedor);
    if (fechaDesde) consulta = consulta.gte("fecha_vencimiento", fechaDesde);
    if (fechaHasta) consulta = consulta.lte("fecha_vencimiento", fechaHasta);

    const { data, error } = await consulta;

    if (error) return { lotes: [], error: normalizarError(error) };
    // Siempre un arreglo: una lista vacia se dibuja sola, un null obliga a comprobarlo cada vez.
    return { lotes: (data ?? []).map(aLote), error: null };
  } catch (error) {
    return { lotes: [], error: normalizarError(error) };
  }
}

/**
 * Lotes de un medicamento, ordenados por fecha de vencimiento (criterio de aceptacion de la
 * issue). Azucar sobre listarLotes({ medicamento }): existe con su propio nombre porque es la
 * consulta que arma la ficha de un medicamento del catalogo, no una pantalla de listado con
 * filtros.
 *
 * @param {string} medicamentoId UUID del medicamento.
 * @returns {Promise<{ lotes: object[], error: object|null }>}
 */
export function listarLotesDeMedicamento(medicamentoId) {
  if (!medicamentoId) return Promise.resolve({ lotes: [], error: null });
  return listarLotes({ medicamento: medicamentoId });
}

/**
 * Un lote por id, con su medicamento y proveedor embebidos (issue #791: pantalla de detalle de
 * lote en movil, que Existencias y el alertario de vencimiento no tenian a donde navegar).
 *
 * `lote: null` sin `error` es un id que no existe: el SELECT de lotes es abierto a cualquier
 * autenticado (00034), asi que en la practica un id valido siempre trae fila.
 *
 * @param {string} id UUID del lote.
 * @returns {Promise<{ lote: object|null, error: object|null }>}
 */
export async function obtenerLote(id) {
  if (!id) return { lote: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("lotes")
      .select(COLUMNAS_DEL_LOTE)
      .eq("id", id)
      .maybeSingle();

    if (error) return { lote: null, error: normalizarError(error) };
    return { lote: aLote(data), error: null };
  } catch (error) {
    return { lote: null, error: normalizarError(error) };
  }
}
