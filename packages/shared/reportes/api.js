// Consultas de Supabase de los indicadores de impacto (issue #205).
//
// La version anterior no podia funcionar: consultaba `vista_indicadores_impacto`, que no existe en
// ninguna migracion, y le pedia dos columnas inventadas (`comunidades_beneficiadas` y `mes`). La
// vista real es `vista_reporte_impacto` (00027, redefinida en la 00054 y ampliada con el proyecto
// en la 00064). Ademas comparaba el rol contra "junta_directiva" con guion bajo, cuando el enum
// rol_usuario declara 'junta directiva' con espacio: junta directiva nunca pasaba el chequeo.
//
// La vista tiene grano de UNA FILA POR JORNADA. Los cuatro indicadores del requerimiento salen de
// agregar esas filas, no de columnas propias:
//
//   pacientes atendidos     SUM(pacientes_atendidos)
//   comunidades beneficiadas COUNT(DISTINCT comunidad_id)   <- no es una columna, y no puede serlo:
//                                                              a nivel de una jornada valdria uno
//                                                              siempre (COMMENT de la 00027)
//   tratamientos entregados SUM(tratamientos_entregados)
//   medicamentos utilizados SUM(medicamentos_utilizados)
//
// El mes tampoco es una columna: se deriva de `fecha` al agrupar.
//
// Quien decide de verdad quien lee esto es el WHERE de la propia vista, que solo devuelve filas a
// administrador, junta directiva y socio fundador (00054). El chequeo de rol de aqui es para que
// la pantalla no dispare una consulta que sabe que volvera vacia, no una barrera de seguridad.
//
// Los datos son agregados: ninguna fila identifica a un paciente. Es el criterio de la issue #205
// y la razon de ser de la 00054 (issue #407).

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { puedeVerIndicadoresDeImpacto } from "./permisos.js";

// Reexportar funciones de permisos para mantener la interfaz unificada
export {
  puedeVerIndicadoresDeImpacto,
  puedeVerReporteDePacientes,
  puedeVerReporteJornada,
  puedeVerReporteDeInventario,
  permisosDeReportes,
} from "./permisos.js";

/** Columnas de vista_reporte_impacto que necesita el reporte. */
const COLUMNAS_DEL_REPORTE = [
  "jornada_id",
  "jornada",
  "fecha",
  "comunidad_id",
  "comunidad",
  "proyecto_id",
  "proyecto",
  "pacientes_atendidos",
  "consultas_realizadas",
  "tratamientos_entregados",
  "medicamentos_utilizados",
].join(", ");

/** Criterios de agrupacion que admite el reporte, con la clave y la etiqueta de cada grupo. */
export const AGRUPACIONES_DE_IMPACTO = {
  MES: "mes",
  COMUNIDAD: "comunidad",
  JORNADA: "jornada",
  PROYECTO: "proyecto",
};

// `consultas_realizadas` la calculaba vista_reporte_impacto en cada consulta y no la leia nadie:
// no estaba en COLUMNAS_DEL_REPORTE, asi que el trabajo se tiraba (issue #693). Se suma como un
// indicador mas en vez de retirarla de la vista con una migracion: es un dato que el reporte de
// jornada ya muestra por jornada, y aqui da el acumulado del periodo.
const INDICADORES = [
  "pacientes_atendidos",
  "consultas_realizadas",
  "tratamientos_entregados",
  "medicamentos_utilizados",
];

/** '2026-08-14' -> '2026-08'. La vista no trae el mes: se deriva de la fecha. */
function mesDe(fecha) {
  return typeof fecha === "string" ? fecha.slice(0, 7) : null;
}

/**
 * Clave y etiqueta del grupo al que pertenece una fila, segun el criterio de agrupacion.
 *
 * La etiqueta viaja aparte de la clave porque agrupar por comunidad o por proyecto se hace por id
 * -dos comunidades pueden llamarse igual- pero se muestra por nombre.
 */
function grupoDe(fila, agruparPor) {
  switch (agruparPor) {
    case AGRUPACIONES_DE_IMPACTO.MES:
      return { clave: mesDe(fila.fecha), etiqueta: mesDe(fila.fecha) };
    case AGRUPACIONES_DE_IMPACTO.COMUNIDAD:
      return { clave: fila.comunidad_id, etiqueta: fila.comunidad };
    case AGRUPACIONES_DE_IMPACTO.JORNADA:
      return { clave: fila.jornada_id, etiqueta: fila.jornada };
    case AGRUPACIONES_DE_IMPACTO.PROYECTO:
      // proyecto_id es nullable: una jornada suelta no cuelga de ningun proyecto.
      return {
        clave: fila.proyecto_id ?? "sin_proyecto",
        etiqueta: fila.proyecto ?? "Sin proyecto",
      };
    default:
      return null;
  }
}

/**
 * Agrega un conjunto de filas de la vista a los cuatro indicadores del requerimiento.
 *
 * `comunidades_beneficiadas` se cuenta aparte, con un Set de comunidad_id: sumarla como los demas
 * daria el numero de jornadas, no el de comunidades distintas, que es lo que el indicador mide.
 */
function agregar(filas) {
  const totales = Object.fromEntries(INDICADORES.map((indicador) => [indicador, 0]));
  const comunidades = new Set();

  for (const fila of filas) {
    for (const indicador of INDICADORES) totales[indicador] += Number(fila[indicador] ?? 0);
    if (fila.comunidad_id) comunidades.add(fila.comunidad_id);
  }

  return { ...totales, comunidades_beneficiadas: comunidades.size };
}

function variacion(actual, anterior) {
  const diferencia = actual - anterior;
  const porcentaje =
    anterior === 0 ? (actual > 0 ? 100 : 0) : Number(((diferencia / anterior) * 100).toFixed(2));

  return { actual, anterior, diferencia, porcentaje };
}

/**
 * Indicadores de impacto de un periodo, opcionalmente agrupados y comparados contra otro periodo.
 *
 * @param {object} opciones
 * @param {string} opciones.rol Rol de quien consulta.
 * @param {{ fechaInicio?: string, fechaFin?: string }} [opciones.periodo] Rango sobre jornadas.fecha.
 * @param {{ fechaInicio?: string, fechaFin?: string }} [opciones.periodoComparacion] Segundo rango.
 * @param {string} [opciones.agruparPor] Uno de AGRUPACIONES_DE_IMPACTO.
 * @param {string} [opciones.comunidad] UUID de comunidad.
 * @param {string} [opciones.jornada] UUID de jornada.
 * @param {string} [opciones.proyecto] UUID de proyecto.
 * @returns {Promise<{ indicadores: object|null, error: object|null }>}
 */
export async function obtenerIndicadoresImpacto({
  rol,
  periodo,
  periodoComparacion,
  agruparPor,
  comunidad,
  jornada,
  proyecto,
} = {}) {
  if (!puedeVerIndicadoresDeImpacto(rol)) {
    return {
      indicadores: null,
      error: {
        codigo: "SIN_PERMISO",
        mensaje: "Solo administracion y junta directiva consultan los indicadores de impacto.",
      },
    };
  }

  async function filasDe(rango) {
    let consulta = obtenerSupabase()
      .from("vista_reporte_impacto")
      .select(COLUMNAS_DEL_REPORTE)
      .order("fecha", { ascending: true });

    if (rango?.fechaInicio) consulta = consulta.gte("fecha", rango.fechaInicio);
    if (rango?.fechaFin) consulta = consulta.lte("fecha", rango.fechaFin);
    if (comunidad) consulta = consulta.eq("comunidad_id", comunidad);
    if (jornada) consulta = consulta.eq("jornada_id", jornada);
    if (proyecto) consulta = consulta.eq("proyecto_id", proyecto);

    const { data, error } = await consulta;
    if (error) throw error;
    return data ?? [];
  }

  try {
    const filas = await filasDe(periodo);
    const totales = agregar(filas);

    let agrupados = [];
    if (agruparPor) {
      const porGrupo = new Map();

      for (const fila of filas) {
        const grupo = grupoDe(fila, agruparPor);
        if (!grupo) continue;

        if (!porGrupo.has(grupo.clave)) porGrupo.set(grupo.clave, { ...grupo, filas: [] });
        porGrupo.get(grupo.clave).filas.push(fila);
      }

      agrupados = [...porGrupo.values()].map(({ clave, etiqueta, filas: filasDelGrupo }) => ({
        clave,
        etiqueta,
        ...agregar(filasDelGrupo),
      }));
    }

    let comparacion = null;
    if (periodoComparacion) {
      const anteriores = agregar(await filasDe(periodoComparacion));

      comparacion = {
        totales: anteriores,
        variacion: Object.fromEntries(
          [...INDICADORES, "comunidades_beneficiadas"].map((indicador) => [
            indicador,
            variacion(totales[indicador], anteriores[indicador]),
          ]),
        ),
      };
    }

    return { indicadores: { totales, agrupados, comparacion }, error: null };
  } catch (error) {
    return { indicadores: null, error: normalizarError(error) };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// REPORTE DE MEDICAMENTOS PRÓXIMOS A VENCER (issue #213)
// ──────────────────────────────────────────────────────────────────────────────

/** Columnas que necesita el reporte de lotes por vencer */
const COLUMNAS_LOTES_POR_VENCER = [
  "id",
  "numero_lote",
  "fecha_vencimiento",
  "cantidad_actual",
  "medicamento_id",
  "bodega_id",
  // Relaciones con tablas reales
  "medicamentos!inner(nombre, concentracion, presentacion)",
  "bodegas!inner(nombre)",
].join(", ");
/**
 * Lista lotes próximos a vencer con filtros.
 * Se apoya en la vista o función que calcula `dias_restantes` en la BD.
 *
 * @param {object} opciones
 * @param {number} opciones.horizonteDias - Lotes que vencen en X días hacia adelante.
 * @param {string} [opciones.comunidad] - UUID de comunidad o undefined = todas.
 * @param {string} [opciones.bodega] - UUID de bodega o undefined = todas.
 * @returns {Promise<{ lotes: Array, error: object|null }>}
 */
// ──────────────────────────────────────────────────────────────────────────────
// REPORTE DE MEDICAMENTOS PRÓXIMOS A VENCER (issue #213)
// ──────────────────────────────────────────────────────────────────────────────

/** Columnas REALES de la tabla lotes + relaciones que sí existen */
/**
 * Lista lotes próximos a vencer con filtros.
 * Calcula días restantes desde el código.
 */
export async function listarLotesPorVencer({ horizonteDias, comunidad, bodega } = {}) {
  try {
    const hoy = new Date();
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(hoy.getDate() + (horizonteDias ?? 30));
    const hoyStr = hoy.toISOString().slice(0, 10);
    const limiteStr = fechaLimite.toISOString().slice(0, 10);

    let consulta = obtenerSupabase()
      .from("lotes")
      .select(COLUMNAS_LOTES_POR_VENCER)
      .lte("fecha_vencimiento", limiteStr)
      .gte("fecha_vencimiento", hoyStr)
      .order("fecha_vencimiento", { ascending: true });

    if (bodega) consulta = consulta.eq("bodega_id", bodega);

    // ⚠️ Si comunidad NO es columna directa en lotes, se filtra por medicamento o jornada
    // if (comunidad) consulta = consulta.eq("comunidad_id", comunidad);

    const { data, error } = await consulta;
    if (error) throw error;

    // ✅ Mapeo y cálculo de días restantes
    const lotes = (data ?? []).map((fila) => {
      const diasRestantes = calcularDiasRestantes(fila.fecha_vencimiento);
      return {
        id: fila.id,
        lote: fila.numero_lote,
        numero_lote: fila.numero_lote,
        medicamento: fila.medicamentos?.nombre || "—",
        concentracion: fila.medicamentos?.concentracion || "",
        presentacion: fila.medicamentos?.presentacion || "",
        fecha_vencimiento: fila.fecha_vencimiento,
        vencimiento: fila.fecha_vencimiento,
        dias_restantes: diasRestantes,
        cantidad: fila.cantidad_actual,
        cantidad_actual: fila.cantidad_actual,
        bodega: fila.bodegas?.nombre || "—",
        bodega_id: fila.bodega_id,
      };
    });

    return { lotes, error: null };
  } catch (error) {
    return { lotes: [], error: normalizarError(error) };
  }
}

/** Calcula días restantes desde JS */
function calcularDiasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaVencimiento);
  vence.setHours(0, 0, 0, 0);
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.ceil((vence - hoy) / msPorDia);
}

/** Calcula días restantes desde JS como respaldo */
function calcularDiasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return 0;
  const hoy = new Date();
  const vence = new Date(fechaVencimiento);
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.ceil((vence - hoy) / msPorDia);
}

// ──────────────────────────────────────────────────────────────────────────────
// CATÁLOGOS: Comunidades y Bodegas
// ──────────────────────────────────────────────────────────────────────────────

/** Lista de comunidades (reutiliza la que ya existe en tu proyecto) */
export async function listarComunidades() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("comunidades")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (error) throw error;
    return { comunidades: data ?? [], error: null };
  } catch (error) {
    return { comunidades: [], error: normalizarError(error) };
  }
}

/** Lista de bodegas */
export async function listarBodegas() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("bodegas")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (error) throw error;
    return { bodegas: data ?? [], error: null };
  } catch (error) {
    return { bodegas: [], error: normalizarError(error) };
  }
}
