// Reporte de enfermedades por jornada y comunidad (issue #916).
//
// "Enfermedad" es el diagnostico del catalogo que el medico asigna en la consulta
// (consulta_diagnostico), nunca el texto libre de consultas.sintomas. El conteo lo hace la base
// (fn_reporte_enfermedades, 00177), como ya se corrigio en jornada.api.js: traerse las consultas
// fila por fila al cliente seria exponerselas a los roles consultivos aunque solo se mostraran
// totales.
//
// Solo llegan conteos agregados, nunca una fila por paciente. Cada cifra trae su numero real, tambien
// las de 1 a 4: la 00177 las ocultaba como "< 5" y la organizacion pidio verlas (issue #926, 00180).

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

// La guarda vive en permisos.js; se reexporta el mismo binding, como hace jornada.api.js.
export { puedeVerReporteDeEnfermedades } from "./permisos.js";
import { puedeVerReporteDeEnfermedades } from "./permisos.js";

/** Las cuatro vistas del reporte. */
export const VISTAS_DE_ENFERMEDADES = Object.freeze({
  RANKING: "ranking",
  JORNADAS: "jornadas",
  COMUNIDADES: "comunidades",
  EVOLUCION: "evolucion",
});

/** Como agrupa la base cada vista (p_agrupar_por de fn_reporte_enfermedades). */
const AGRUPACION_DE_VISTA = Object.freeze({
  [VISTAS_DE_ENFERMEDADES.RANKING]: "ninguno",
  [VISTAS_DE_ENFERMEDADES.JORNADAS]: "jornada",
  [VISTAS_DE_ENFERMEDADES.COMUNIDADES]: "comunidad",
  [VISTAS_DE_ENFERMEDADES.EVOLUCION]: "mes",
});

/** Que comunidad cuenta: donde se atendio o de donde viene el paciente (p_comunidad_de). */
export const COMUNIDAD_DE = Object.freeze({
  JORNADA: "jornada",
  PACIENTE: "paciente",
});

const MENSAJE_SIN_PERMISO =
  "Solo administración, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de enfermedades.";

/** Una fila de la funcion, con nombres de JS. */
function aCasoDeEnfermedad(fila) {
  return {
    grupoId: fila.grupo_id,
    grupo: fila.grupo,
    grupoFecha: fila.grupo_fecha,
    diagnosticoId: fila.diagnostico_id,
    codigo: fila.codigo,
    diagnostico: fila.diagnostico,
    orden: fila.orden_diagnostico,
    casos: fila.casos,
    hombres: fila.hombres,
    mujeres: fila.mujeres,
    menores: fila.menores,
    adultos: fila.adultos,
    adultosMayores: fila.adultos_mayores,
  };
}

/**
 * Casos por enfermedad, agregados en la base.
 *
 * La guarda de rol de aqui solo evita una llamada que la base va a rechazar; quien deniega de
 * verdad es la guarda de fn_reporte_enfermedades.
 *
 * @param {object} [parametros]
 * @param {string} [parametros.rol] Rol de quien consulta.
 * @param {string} [parametros.vista] Uno de VISTAS_DE_ENFERMEDADES; por defecto el ranking.
 * @param {string} [parametros.desde] Fecha AAAA-MM-DD inicial (fecha de la jornada).
 * @param {string} [parametros.hasta] Fecha AAAA-MM-DD final.
 * @param {string[]} [parametros.jornadas] UUIDs de jornada; vacio = todas.
 * @param {string[]} [parametros.comunidades] UUIDs de comunidad; vacio = todas.
 * @param {number|string} [parametros.municipio]
 * @param {number|string} [parametros.departamento]
 * @param {string} [parametros.proyecto] UUID de proyecto.
 * @param {string} [parametros.diagnostico] UUID de diagnostico.
 * @param {boolean} [parametros.soloPrincipales] Por defecto true.
 * @param {string} [parametros.comunidadDe] Uno de COMUNIDAD_DE; por defecto la de la jornada.
 * @returns {Promise<{ casos: object[], error: object|null }>}
 */
export async function obtenerReporteEnfermedades({
  rol,
  vista = VISTAS_DE_ENFERMEDADES.RANKING,
  desde,
  hasta,
  jornadas = [],
  comunidades = [],
  municipio,
  departamento,
  proyecto,
  diagnostico,
  soloPrincipales = true,
  comunidadDe = COMUNIDAD_DE.JORNADA,
} = {}) {
  if (rol !== undefined && !puedeVerReporteDeEnfermedades(rol)) {
    return { casos: [], error: { codigo: "SIN_PERMISO", mensaje: MENSAJE_SIN_PERMISO } };
  }

  const agruparPor = AGRUPACION_DE_VISTA[vista];
  if (!agruparPor) {
    return {
      casos: [],
      error: { codigo: "VALOR_INVALIDO", mensaje: `Vista de reporte desconocida: ${vista}.` },
    };
  }

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_reporte_enfermedades", {
      p_agrupar_por: agruparPor,
      p_desde: desde || null,
      p_hasta: hasta || null,
      p_jornada_ids: jornadas.length > 0 ? jornadas : null,
      p_comunidad_ids: comunidades.length > 0 ? comunidades : null,
      p_municipio_id: municipio ? Number(municipio) : null,
      p_departamento_id: departamento ? Number(departamento) : null,
      p_proyecto_id: proyecto || null,
      p_diagnostico_id: diagnostico || null,
      p_solo_principales: soloPrincipales,
      p_comunidad_de: comunidadDe,
    });

    if (error) return { casos: [], error: normalizarError(error) };
    return { casos: (data ?? []).map(aCasoDeEnfermedad), error: null };
  } catch (error) {
    return { casos: [], error: normalizarError(error) };
  }
}

/**
 * Lo que el reporte ofrece para elegir: jornadas y diagnosticos con casos, y proyectos con
 * jornadas. Sale de una funcion de la base y no de listarJornadas()/listarProyectos() porque los
 * roles consultivos no leen esas tablas, y sus selectores saldrian vacios.
 *
 * @param {{ rol?: string }} [parametros]
 * @returns {Promise<{ opciones: { jornadas: object[], proyectos: object[], diagnosticos: object[] }, error: object|null }>}
 */
export async function obtenerOpcionesReporteEnfermedades({ rol } = {}) {
  const vacias = { jornadas: [], proyectos: [], diagnosticos: [] };

  if (rol !== undefined && !puedeVerReporteDeEnfermedades(rol)) {
    return { opciones: vacias, error: { codigo: "SIN_PERMISO", mensaje: MENSAJE_SIN_PERMISO } };
  }

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_opciones_reporte_enfermedades");

    if (error) return { opciones: vacias, error: normalizarError(error) };
    return {
      opciones: {
        jornadas: data?.jornadas ?? [],
        proyectos: data?.proyectos ?? [],
        diagnosticos: data?.diagnosticos ?? [],
      },
      error: null,
    };
  } catch (error) {
    return { opciones: vacias, error: normalizarError(error) };
  }
}
