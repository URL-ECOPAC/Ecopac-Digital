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
// pacientes atendidos     SUM(pacientes_atendidos)
// comunidades beneficiadas COUNT(DISTINCT comunidad_id)   <- no es una columna, y no puede serlo:
// a nivel de una jornada valdria uno
// siempre (COMMENT de la 00027)
// tratamientos entregados SUM(tratamientos_entregados)
// medicamentos utilizados SUM(medicamentos_utilizados)
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
import { obtenerTodasLasFilas } from "../api/paginacion.js";
import { puedeVerIndicadoresDeImpacto } from "./permisos.js";

// Reexportar funciones de permisos para mantener la interfaz unificada
export {
  puedeVerIndicadoresDeImpacto,
  puedeVerReporteDePacientes,
  puedeVerReporteJornada,
  puedeVerReporteDeInventario,
  permisosDeReportes,
} from "./permisos.js";

/**
 * Columnas de vista_reporte_impacto que necesita el reporte.
 *
 * ISSUE #862: faltaba `estado_jornada`, que la vista expone desde la 00027 y que nadie leia. Sin
 * ella el reporte suma en el mismo total las jornadas finalizadas, las planificadas y las
 * canceladas, sin forma de distinguirlas: una jornada cancelada aportaba sus cero pacientes al
 * promedio y una planificada ensuciaba el conteo de comunidades beneficiadas.
 */
const COLUMNAS_DEL_REPORTE = [
  "jornada_id",
  "jornada",
  "fecha",
  "estado_jornada",
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
 * @param {string} [opciones.estadoJornada] Uno de ESTADOS_JORNADA; sin el, todos los estados.
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
  estadoJornada,
} = {}) {
  if (!puedeVerIndicadoresDeImpacto(rol)) {
    return {
      indicadores: null,
      error: {
        codigo: "SIN_PERMISO",
        mensaje:
          "Solo administración y los roles consultivos consultan los indicadores de impacto.",
      },
    };
  }

  // obtenerTodasLasFilas() y no un simple `await consulta` (issue #773): agregar() suma estas
  // filas en JavaScript, y vista_reporte_impacto no tiene techo de filas -- crece con cada
  // jornada que pasa. Sin paginar, pasadas las 1000 filas (max_rows, supabase/config.toml)
  // PostgREST cortaria la respuesta sin error y los totales de impacto empezarian a mentir en
  // silencio, exactamente lo que describe la issue.
  function fabricaDeConsulta(rango) {
    return () => {
      let consulta = obtenerSupabase()
        .from("vista_reporte_impacto")
        .select(COLUMNAS_DEL_REPORTE)
        .order("fecha", { ascending: true });

      if (rango?.fechaInicio) consulta = consulta.gte("fecha", rango.fechaInicio);
      if (rango?.fechaFin) consulta = consulta.lte("fecha", rango.fechaFin);
      if (comunidad) consulta = consulta.eq("comunidad_id", comunidad);
      if (jornada) consulta = consulta.eq("jornada_id", jornada);
      if (proyecto) consulta = consulta.eq("proyecto_id", proyecto);
      if (estadoJornada) consulta = consulta.eq("estado_jornada", estadoJornada);

      return consulta;
    };
  }

  async function filasDe(rango) {
    const { filas, error } = await obtenerTodasLasFilas(fabricaDeConsulta(rango));
    if (error) throw error;
    return filas ?? [];
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

// Un lote con sus existencias por bodega. `existencias` es el stock vivo (00020, 00047); la cantidad
// que entro al lote (`cantidad_ingresada`) no dice cuanto queda.
const COLUMNAS_LOTES_POR_VENCER = [
  "id",
  "numero_lote",
  "fecha_vencimiento",
  "medicamento_id",
  "medicamentos!inner(nombre, concentracion, presentacion:presentaciones(nombre))",
  "existencias(cantidad_disponible, bodega_id, bodega:bodegas(nombre))",
].join(", ");

/**
 * Lotes que vencen entre hoy y `horizonteDias`, con las unidades que quedan de cada uno.
 *
 * QUE ESTABA MAL, y por que el reporte decia "Ningun lote vence" mientras la pestana de alertas
 * mostraba uno:
 *
 *   - La cantidad era la cadena "—" ("columna por confirmar nombre"), asi que el total en riesgo
 *     salia NaN o cero; la bodega, igual.
 *   - Hoy y la fecha limite se calculaban con toISOString(), en UTC: de noche el rango empezaba
 *     manana y un lote que vence hoy quedaba fuera. Los dias restantes, con new Date("AAAA-MM-DD"),
 *     llegaban adelantados un dia.
 *   - Los filtros de bodega y comunidad estaban comentados: elegir uno no hacia nada.
 *   - Y la causa principal, del lado de la pantalla: el hook se llamaba sin el rol, asi que su
 *     permiso salia falso y nunca consultaba (ver ReportesPage.jsx).
 *
 * El filtro de comunidad se retira: `bodegas` no tiene comunidad (00017) y un lote no vive en
 * ninguna, asi que no hay forma honesta de responderlo.
 *
 * @param {object} opciones
 * @param {number} [opciones.horizonteDias] Dias hacia adelante (30 por defecto).
 * @param {string} [opciones.bodega] UUID de bodega, o undefined para todas.
 * @param {Date} [opciones.hoy] Solo para pruebas.
 * @returns {Promise<{ lotes: Array, error: object|null }>}
 */
export async function listarLotesPorVencer({ horizonteDias, bodega, hoy = new Date() } = {}) {
  try {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    // Clona inicio en vez de aFechaLocal(inicio) -que devolveria la MISMA referencia- porque a
    // continuacion se muta con setDate: mutar inicio directamente correria tambien el limite de
    // busqueda inferior.
    // eslint-disable-next-line no-restricted-syntax -- clona para mutar sin afectar el parametro
    const limite = new Date(inicio);
    limite.setDate(inicio.getDate() + (horizonteDias ?? 30));

    const { data, error } = await obtenerSupabase()
      .from("lotes")
      .select(COLUMNAS_LOTES_POR_VENCER)
      .gte("fecha_vencimiento", aCadenaFechaLocal(inicio))
      .lte("fecha_vencimiento", aCadenaFechaLocal(limite))
      .order("fecha_vencimiento", { ascending: true });

    if (error) throw error;

    const lotes = (data ?? [])
      .map((fila) => {
        const existencias = (fila.existencias ?? []).filter(
          (existencia) => !bodega || existencia.bodega_id === bodega,
        );
        const cantidad = existencias.reduce(
          (suma, existencia) => suma + Number(existencia.cantidad_disponible || 0),
          0,
        );
        const bodegas = [
          ...new Set(existencias.map((existencia) => existencia.bodega?.nombre).filter(Boolean)),
        ];

        return {
          id: fila.id,
          lote: fila.numero_lote,
          numero_lote: fila.numero_lote,
          medicamento: fila.medicamentos?.nombre || "—",
          concentracion: fila.medicamentos?.concentracion || "",
          // presentacion:presentaciones(nombre) en el select llega anidado (00144).
          presentacion: fila.medicamentos?.presentacion?.nombre || "",
          fecha_vencimiento: fila.fecha_vencimiento,
          vencimiento: fila.fecha_vencimiento,
          dias_restantes: diasHastaVencimiento(fila.fecha_vencimiento, inicio) ?? 0,
          cantidad,
          bodega: bodegas.join(", ") || null,
          tieneExistenciaEnBodega: existencias.length > 0,
        };
      })
      // Con una bodega elegida, solo los lotes que tienen existencia en ella.
      .filter((lote) => !bodega || lote.tieneExistenciaEnBodega);

    return { lotes, error: null };
  } catch (error) {
    return { lotes: [], error: normalizarError(error) };
  }
}
