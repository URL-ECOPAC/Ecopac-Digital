// Historial de donaciones recibidas, con filtros, totales por tipo y paginacion (issue #193,
// RF-28).
//
// `donaciones` no tiene columna de importe ni de cantidad -eso vive por renglon en
// donacion_detalle, ver el comentario de campos.js- asi que los totales por tipo no se leen de
// una columna: se agregan aqui sobre donacion_detalle, mismo patron que
// reportes/inventario.api.js (agrupar()/calcularTotales()). Es la misma razon por la que
// donantes.api.js -> obtenerHistoricoDonante() da siempre 0: suma `d.monto_total`, una columna
// que nunca existio. Ese bug es de otro archivo y no se corrige aqui.
//
// `donaciones.proyecto_id` es de la migracion 00097, agregada junto con esta issue: el criterio
// de aceptacion pide filtrar por proyecto y la columna no existia (donaciones/filtros.js, issue
// #287, ya documentaba esa ausencia dejando FILTROS_DONACION sin esa entrada).

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { TIPOS_DE_DONACION } from "./campos.js";
import { puedeVerDonaciones } from "./permisos.js";

const COLUMNAS_DE_LA_DONACION = [
  "id",
  "fecha",
  "tipo",
  "estado",
  "observaciones",
  "motivoAnulacion:motivo_anulacion",
  "anuladaPor:anulada_por",
  "anuladaEn:anulada_en",
  "registradoPor:registrado_por",
  "donanteId:donante_id",
  "proyectoId:proyecto_id",
  "donante:donantes(nombre)",
].join(", ");

function validarRolLectura(rolUsuario) {
  if (!puedeVerDonaciones(rolUsuario)) {
    return {
      datos: null,
      error: { mensaje: "No tienes permisos de lectura para el historial de donaciones." },
    };
  }
  return null;
}

/** Aplica a `consulta` los filtros que comparten el listado y el calculo de totales. */
function aplicarFiltros(consulta, { donanteId, tipo, estado, fechaInicio, fechaFin, proyectoId }) {
  let filtrada = consulta;

  if (donanteId) filtrada = filtrada.eq("donante_id", donanteId);
  if (tipo) filtrada = filtrada.eq("tipo", tipo);
  if (proyectoId) filtrada = filtrada.eq("proyecto_id", proyectoId);
  if (fechaInicio) filtrada = filtrada.gte("fecha", fechaInicio);
  if (fechaFin) filtrada = filtrada.lte("fecha", fechaFin);

  // Sin estado explicito, las anuladas quedan fuera por defecto (mismo criterio que
  // obtenerHistoricoDonante() en donantes.api.js); pedir un estado puntual -incluida 'anulada'-
  // es como el criterio de aceptacion resuelve "incluir o excluir mediante un filtro".
  filtrada = estado ? filtrada.eq("estado", estado) : filtrada.neq("estado", "anulada");

  return filtrada;
}

function aDonacion(fila) {
  return {
    id: fila.id,
    fecha: fila.fecha,
    tipo: fila.tipo,
    estado: fila.estado,
    observaciones: fila.observaciones,
    motivoAnulacion: fila.motivoAnulacion,
    anuladaPor: fila.anuladaPor,
    anuladaEn: fila.anuladaEn,
    registradoPor: fila.registradoPor,
    donanteId: fila.donanteId,
    proyectoId: fila.proyectoId,
    donanteNombre: fila.donante?.nombre ?? null,
  };
}

/**
 * Totales por tipo de donacion sobre TODO el conjunto filtrado (no solo la pagina actual): es lo
 * que pide el criterio "totales agregados... en el periodo consultado". `dinero` suma el monto
 * de cada renglon; `medicamentos` e `insumos` suman la cantidad; `servicios` cuenta donaciones,
 * no unidades -no las tiene, mismo criterio que TIPOS_QUE_EXIGEN_CANTIDAD en validaciones.js.
 */
async function calcularTotalesPorTipo(filtros) {
  const vacio = { dinero: 0, medicamentos: 0, insumos: 0, servicios: 0 };

  const consulta = aplicarFiltros(
    obtenerSupabase().from("donaciones").select("tipo, detalle:donacion_detalle(cantidad, monto)"),
    filtros,
  );
  const { data, error } = await consulta;
  if (error) return { totales: vacio, error: normalizarError(error) };

  const totales = { ...vacio };
  for (const donacion of data ?? []) {
    const renglones = donacion.detalle ?? [];
    if (donacion.tipo === TIPOS_DE_DONACION.DINERO) {
      totales.dinero += renglones.reduce((suma, r) => suma + Number(r.monto ?? 0), 0);
    } else if (donacion.tipo === TIPOS_DE_DONACION.SERVICIOS) {
      totales.servicios += 1;
    } else if (
      donacion.tipo === TIPOS_DE_DONACION.MEDICAMENTOS ||
      donacion.tipo === TIPOS_DE_DONACION.INSUMOS
    ) {
      totales[donacion.tipo] += renglones.reduce((suma, r) => suma + Number(r.cantidad ?? 0), 0);
    }
  }

  return { totales, error: null };
}

/**
 * Historial de donaciones recibidas: filtros por donante, tipo, proyecto y rango de fechas,
 * estado (por defecto excluye anuladas), paginado y totales por tipo del periodo consultado.
 *
 * Consultan administrador, junta directiva y socio fundador (puedeVerDonaciones(), espejo de la
 * politica SELECT de la 00083); nadie mas llega a Supabase.
 *
 * @param {object} [filtros]
 * @param {string} [filtros.donanteId] UUID de donante.
 * @param {string} [filtros.tipo] Uno de TIPOS_DE_DONACION.
 * @param {string} [filtros.estado] Uno de ESTADOS_DE_DONACION; sin el, excluye 'anulada'.
 * @param {string} [filtros.fechaInicio] AAAA-MM-DD, inclusive.
 * @param {string} [filtros.fechaFin] AAAA-MM-DD, inclusive.
 * @param {string} [filtros.proyectoId] UUID de proyecto.
 * @param {number} [filtros.limite] Tamano de pagina; sin el, no pagina.
 * @param {number} [filtros.pagina] Pagina 1-indexada.
 * @param {{ rolUsuario: string }} contexto
 * @returns {Promise<{ datos: { donaciones: object[], total: number, pagina: number,
 *   porPagina: number|null, totalesPorTipo: object }|null, error: object|null }>}
 */
export async function listarDonaciones(
  { donanteId, tipo, estado, fechaInicio, fechaFin, proyectoId, limite, pagina = 1 } = {},
  { rolUsuario } = {},
) {
  const errorRol = validarRolLectura(rolUsuario);
  if (errorRol) return errorRol;

  const filtros = { donanteId, tipo, estado, fechaInicio, fechaFin, proyectoId };

  try {
    const pagina_ = Math.max(1, Number(pagina) || 1);
    const porPagina = limite === undefined || limite === null ? null : Math.max(1, Number(limite));

    let consulta = aplicarFiltros(
      obtenerSupabase()
        .from("donaciones")
        .select(COLUMNAS_DE_LA_DONACION, porPagina === null ? undefined : { count: "exact" })
        .order("fecha", { ascending: false }),
      filtros,
    );

    if (porPagina !== null) {
      const desde = (pagina_ - 1) * porPagina;
      consulta = consulta.range(desde, desde + porPagina - 1);
    }

    const { data, error, count } = await consulta;
    if (error) return { datos: null, error: normalizarError(error) };

    const donaciones = (data ?? []).map(aDonacion);
    const { totales: totalesPorTipo, error: errorTotales } = await calcularTotalesPorTipo(filtros);
    if (errorTotales) return { datos: null, error: errorTotales };

    return {
      datos: {
        donaciones,
        total: count ?? donaciones.length,
        pagina: pagina_,
        porPagina,
        totalesPorTipo,
      },
      error: null,
    };
  } catch (error) {
    return { datos: null, error: normalizarError(error) };
  }
}
