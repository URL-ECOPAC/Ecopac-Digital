import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { obtenerTodasLasFilas } from "../api/paginacion.js";
import { aCadenaFechaLocal } from "../formato/fechas.js";

export const LIMITE_DE_EXISTENCIAS_POR_DEFECTO = 50;

const COLUMNAS_DEL_CONTENIDO = [
  "loteId:lote_id",
  "bodegaId:bodega_id",
  "cantidadDisponible:cantidad_disponible",
  "bodega:bodegas(nombre)",
  "lote:lotes(numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, " +
    "medicamentoId:medicamento_id, costoUnitario:costo_unitario, " +
    "articulo:medicamentos(nombre, concentracion, tipoArticulo:tipo_articulo))",
].join(", ");

/**
 * Aplana una fila de existencias con su lote y su articulo. `vencido` se calcula contra `hoy`: un
 * lote sin fecha (un insumo, 00171) no vence. Pura y exportada para probarla sin Supabase.
 *
 * @param {object} fila
 * @param {string} [hoy] Fecha local AAAA-MM-DD; se inyecta en las pruebas.
 * `costoUnitario` es el del lote (00121) y `valor` lo que vale lo que queda; los dos en null cuando
 * no se conoce el costo, que no es lo mismo que cero.
 *
 * @returns {object} Con: loteId, bodegaId, bodega, numeroLote, fechaVencimiento, vencido, medicamentoId, articulo, tipoArticulo, cantidadDisponible, costoUnitario, valor.
 */
export function aContenidoDeBodega(fila, hoy = aCadenaFechaLocal()) {
  const lote = fila.lote ?? {};
  const articulo = lote.articulo ?? {};
  const fechaVencimiento = lote.fechaVencimiento ?? null;
  const tieneCosto = lote.costoUnitario !== null && lote.costoUnitario !== undefined;
  return {
    loteId: fila.loteId,
    bodegaId: fila.bodegaId,
    bodega: fila.bodega?.nombre ?? null,
    numeroLote: lote.numeroLote ?? null,
    fechaVencimiento,
    vencido: Boolean(fechaVencimiento) && fechaVencimiento < hoy,
    medicamentoId: lote.medicamentoId ?? null,
    articulo: articulo.concentracion
      ? `${articulo.nombre} (${articulo.concentracion})`
      : (articulo.nombre ?? ""),
    tipoArticulo: articulo.tipoArticulo ?? null,
    cantidadDisponible: Number(fila.cantidadDisponible ?? 0),
    costoUnitario: tieneCosto ? Number(lote.costoUnitario) : null,
    valor: tieneCosto
      ? Math.round(Number(lote.costoUnitario) * Number(fila.cantidadDisponible ?? 0) * 100) / 100
      : null,
  };
}

/**
 * Valor de lo que hay en una o varias bodegas (listarContenidoDeBodegas()): la suma de lo que tiene
 * costo y cuantos lotes no lo tienen. No se finge un total para los que no se conocen.
 *
 * @param {Array<{ valor: number|null }>} contenido
 * @returns {{ valor: number, lotesSinCosto: number, unidades: number }}
 */
export function valorizarContenidoDeBodega(contenido = []) {
  return {
    valor: Math.round(contenido.reduce((suma, fila) => suma + (fila.valor ?? 0), 0) * 100) / 100,
    lotesSinCosto: contenido.filter((fila) => fila.valor === null).length,
    unidades: contenido.reduce((suma, fila) => suma + fila.cantidadDisponible, 0),
  };
}

/** Por articulo y, dentro de el, el que vence antes primero; un lote sin fecha va al final. */
function compararContenido(uno, otro) {
  const porArticulo = uno.articulo.localeCompare(otro.articulo, "es");
  if (porArticulo !== 0) return porArticulo;
  if (uno.fechaVencimiento === otro.fechaVencimiento) return 0;
  if (!uno.fechaVencimiento) return 1;
  if (!otro.fechaVencimiento) return -1;
  return uno.fechaVencimiento < otro.fechaVencimiento ? -1 : 1;
}

/**
 * Lo que hay en una o varias bodegas: cada lote con existencia, con su articulo, su vencimiento y su
 * bodega (issue #911). Es la pantalla "Ver contenido" de una bodega y lo que la bodega de botiquin
 * le aporta a los insumos de su jornada y de su proyecto.
 *
 * A diferencia de listarExistenciasDisponibles(), los lotes vencidos SI aparecen, marcados con
 * `vencido`: siguen fisicamente en la bodega y alguien tiene que darlos de baja. Lo que esta en
 * cero no aparece.
 *
 * Trae todas las filas, no solo las primeras 1000 que corta PostgREST (issue #773).
 *
 * @param {string[]} bodegaIds
 * @returns {Promise<{ contenido: object[], error: object|null }>}
 */
export async function listarContenidoDeBodegas(bodegaIds = []) {
  const ids = [...new Set((bodegaIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { contenido: [], error: null };

  try {
    const { filas, error } = await obtenerTodasLasFilas(() =>
      obtenerSupabase()
        .from("existencias")
        .select(COLUMNAS_DEL_CONTENIDO)
        .in("bodega_id", ids)
        .gt("cantidad_disponible", 0)
        .order("lote_id", { ascending: true }),
    );

    if (error) return { contenido: [], error: normalizarError(error) };
    const hoy = aCadenaFechaLocal();
    return {
      contenido: (filas ?? []).map((fila) => aContenidoDeBodega(fila, hoy)).sort(compararContenido),
      error: null,
    };
  } catch (error) {
    return { contenido: [], error: normalizarError(error) };
  }
}

function aExistencia(fila) {
  if (!fila) return null;

  return {
    medicamentoId: fila.medicamento_id,
    medicamento: fila.medicamento,
    concentracion: fila.concentracion,
    presentacion: fila.presentacion,
    marca: fila.marca,
    componentes: fila.componentes ?? [],
    cantidadDisponible: fila.cantidad_disponible,
    fechaVencimientoProxima: fila.fecha_vencimiento_proxima,
    lotesDisponibles: fila.lotes_disponibles,
  };
}

/**
 * Inventario disponible agregado por medicamento, para que el medico sepa que puede recetar
 * antes de recetarlo (RF-18).
 *
 * Llama por RPC a fn_existencias_disponibles (00065), que agrupa en la base: la suma por
 * medicamento y la fecha de vencimiento mas proxima no se pueden pedir por PostgREST, y
 * agregarlas aqui obligaria a traer el catalogo entero antes de paginar.
 *
 * Los lotes vencidos no se cuentan: la funcion se apoya en vista_lotes_disponibles (00047),
 * que los excluye. Como es una vista y no una tabla materializada, un movimiento recien
 * aprobado se refleja en la siguiente llamada sin cache intermedio.
 *
 * @param {object} [filtros]
 * @param {string} [filtros.bodega] UUID de bodega; si se omite, suma todas.
 * @param {string} [filtros.busqueda] Texto libre contra nombre, marca, concentracion y
 *   principio activo, sin distinguir acentos.
 * @param {number} [filtros.limite=50] Filas por pagina.
 * @param {number} [filtros.pagina=1] Numero de pagina, empezando en 1.
 * @returns {Promise<{ existencias: object[], total: number, error: object|null }>} `total` es
 *   la cantidad de medicamentos que cumplen el filtro, sin paginar.
 */
export async function consultarExistencias({
  bodega,
  busqueda,
  limite = LIMITE_DE_EXISTENCIAS_POR_DEFECTO,
  pagina = 1,
} = {}) {
  const filas = Math.max(1, Number(limite) || LIMITE_DE_EXISTENCIAS_POR_DEFECTO);
  const numeroDePagina = Math.max(1, Number(pagina) || 1);

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_existencias_disponibles", {
      p_bodega_id: bodega || null,
      p_busqueda: busqueda || null,
      p_limite: filas,
      p_desplazamiento: (numeroDePagina - 1) * filas,
    });

    if (error) return { existencias: [], total: 0, error: normalizarError(error) };

    const resultado = data ?? [];
    return {
      existencias: resultado.map(aExistencia),
      total: Number(resultado[0]?.total_medicamentos ?? 0),
      error: null,
    };
  } catch (error) {
    return { existencias: [], total: 0, error: normalizarError(error) };
  }
}

/**
 * Existencias disponibles de una bodega concreta. Azucar sobre consultarExistencias({ bodega }):
 * es la consulta que arma la pantalla de inventario de una jornada, no un listado con filtros.
 *
 * @param {string} bodegaId UUID de la bodega.
 * @param {{ busqueda?: string, limite?: number, pagina?: number }} [opciones]
 * @returns {Promise<{ existencias: object[], total: number, error: object|null }>}
 */
export function consultarExistenciasDeBodega(bodegaId, opciones = {}) {
  if (!bodegaId) return Promise.resolve({ existencias: [], total: 0, error: null });
  return consultarExistencias({ ...opciones, bodega: bodegaId });
}

/**
 * Todas las combinaciones (lote, bodega) con existencia disponible, sin filtrar por
 * medicamento. Es lo que necesita un listado general de inventario (catalogo/stock); a
 * diferencia de consultarLotesDisponibles(), que exige un medicamentoId porque arma las
 * opciones de una receta puntual (issue #138), esta consulta es para recorrer "que hay en
 * bodega ahora mismo".
 *
 * Mismos filtros de vista_lotes_disponibles que consultarLotesDisponibles(): solo lotes con
 * cantidad_disponible > 0 y no vencidos (00047). Un lote agotado o vencido no aparece aqui,
 * y un movimiento 'pendiente' tampoco: existencias solo se ajusta cuando el movimiento se
 * aprueba (fn_aplicar_ajuste_existencias).
 *
 * @param {{ bodega?: string, busqueda?: string }} [filtros]
 * @returns {Promise<{ existencias: object[], error: object|null }>}
 */
export async function listarExistenciasDisponibles({ bodega, busqueda } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("vista_lotes_disponibles")
      .select(
        "loteId:lote_id, medicamentoId:medicamento_id, medicamentoNombre:medicamento_nombre, " +
          "numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, " +
          "cantidadDisponible:cantidad_disponible, bodegaId:bodega_id, bodega:bodega_nombre",
      )
      .order("fecha_vencimiento", { ascending: true });

    if (bodega) consulta = consulta.eq("bodega_id", bodega);
    if (busqueda) consulta = consulta.ilike("medicamento_nombre", `%${busqueda}%`);

    const { data, error } = await consulta;

    if (error) return { existencias: [], error: normalizarError(error) };
    return { existencias: data ?? [], error: null };
  } catch (error) {
    return { existencias: [], error: normalizarError(error) };
  }
}

/**
 * Lotes concretos con existencia de un medicamento, con su bodega.
 *
 * consultarExistencias() agrega por medicamento y devuelve `lotesDisponibles` como un CONTEO,
 * no como una lista: sirve para buscar, no para recetar. Para generar una receta hace falta el
 * lote y la bodega concretos (issue #138), que es lo que devuelve esta funcion.
 *
 * La vista ya excluye lo vencido y lo que esta en cero (00047), asi que todo lo que vuelve de
 * aqui se puede entregar.
 *
 * @param {string} medicamentoId
 * @param {{ bodega?: string }} [opciones]
 * @returns {Promise<{ lotes: object[], error: object|null }>}
 */
export async function consultarLotesDisponibles(medicamentoId, { bodega } = {}) {
  if (!medicamentoId) return { lotes: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("vista_lotes_disponibles")
      .select(
        "loteId:lote_id, medicamentoId:medicamento_id, numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, cantidadDisponible:cantidad_disponible, bodegaId:bodega_id, bodega:bodega_nombre",
      )
      .eq("medicamento_id", medicamentoId)
      .order("fecha_vencimiento", { ascending: true });

    if (bodega) consulta = consulta.eq("bodega_id", bodega);

    const { data, error } = await consulta;

    if (error) return { lotes: [], error: normalizarError(error) };
    return { lotes: data ?? [], error: null };
  } catch (error) {
    return { lotes: [], error: normalizarError(error) };
  }
}
