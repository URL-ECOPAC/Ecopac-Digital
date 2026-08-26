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
  "createdAt:created_at",
  "updatedAt:updated_at",
  "medicamento:medicamentos(nombre)",
  "proveedor:proveedores(nombre)",
].join(", ");

// Campos que registrarLote() exige por si mismos (criterio de aceptacion de la issue), ademas de
// lo que ya impone la base de datos. fechaIngreso es el caso que la base no puede cachear sola:
// la columna tiene DEFAULT CURRENT_DATE (00020), asi que omitirla no dispara NOT NULL, solo cae
// en la fecha de hoy en silencio. Los demas (medicamento, numeroLote, cantidadIngresada,
// fechaVencimiento) tambien se listan aqui para dar el mismo error CAMPO_REQUERIDO limpio antes
// de tocar la red, en vez de esperar a que Postgres los rechace uno a la vez.
const CAMPOS_REQUERIDOS_DE_LOTE = [
  "medicamento",
  "numeroLote",
  "cantidadIngresada",
  "fechaIngreso",
  "fechaVencimiento",
];

function faltaAlgunCampoRequerido(datos) {
  return CAMPOS_REQUERIDOS_DE_LOTE.some((campo) => {
    const valor = datos[campo];
    return valor === undefined || valor === null || valor === "";
  });
}

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
    vencido: (diasHastaVencimiento(fila.fechaVencimiento) ?? 0) < 0,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

/**
 * Registra un lote nuevo.
 *
 * Exige medicamento, numeroLote, cantidadIngresada, fechaIngreso y fechaVencimiento (criterio de
 * aceptacion de la issue): si falta alguno, devuelve CAMPO_REQUERIDO sin llamar a la red. El
 * resto de reglas -proveedor y origen obligatorios, cantidad positiva, y sobre todo
 * fecha_vencimiento posterior a fecha_ingreso- las hace cumplir la base de datos
 * (chk_lotes_vencimiento_posterior y chk_lotes_cantidad_positiva, 00020): un intento invalido
 * vuelve como error CHECK, que normalizarError() ya traduce a un mensaje legible. No se duplica
 * esa comprobacion aqui: la migracion es la fuente de verdad de esa regla (AGENTS.md).
 *
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_LOTE.
 * @returns {Promise<{ lote: object|null, error: object|null }>}
 */
export async function registrarLote(datos = {}) {
  if (faltaAlgunCampoRequerido(datos)) {
    return { lote: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("lotes")
      .insert(aColumnasDeTabla(datos))
      .select(COLUMNAS_DEL_LOTE)
      .single();

    if (error) return { lote: null, error: normalizarError(error) };
    return { lote: aLote(data), error: null };
  } catch (error) {
    // Un fallo de red no llega por el campo error sino como excepcion del fetch.
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
