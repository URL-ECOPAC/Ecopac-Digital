import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { ROLES, esAdministrador } from "../usuarios/roles.js";

/** Criterios de agrupacion que admite el reporte de pacientes atendidos. */
export const AGRUPACIONES_DE_PACIENTES = {
  JORNADA: "jornada",
  COMUNIDAD: "comunidad",
  PERIODO: "periodo",
};

/** Roles que pueden consultar el reporte, segun la guarda de fn_reporte_pacientes_atendidos. */
export function puedeVerReporteDePacientes(rol) {
  return esAdministrador(rol) || rol === ROLES.JUNTA_DIRECTIVA;
}

function aGrupo(fila) {
  return {
    id: fila.grupo_id,
    nombre: fila.grupo,
    pacientes: fila.pacientes ?? 0,
    nuevos: fila.nuevos ?? 0,
    recurrentes: fila.recurrentes ?? 0,
    porSexo: { hombres: fila.hombres ?? 0, mujeres: fila.mujeres ?? 0 },
    porEdad: {
      menores: fila.menores ?? 0,
      adultos: fila.adultos ?? 0,
      adultosMayores: fila.adultos_mayores ?? 0,
    },
  };
}

/**
 * Suma los grupos en un unico total. El reporte lo necesita para la cabecera, y sumar aqui es
 * gratis porque los grupos ya vienen agregados de la base.
 *
 * Ojo con `pacientes`: es la suma de los totales de cada grupo, no un conteo de personas
 * distintas. Una misma persona atendida en dos jornadas cuenta en las dos, que es lo correcto
 * para "atenciones por jornada" pero no seria "personas unicas alcanzadas". Con agrupacion por
 * comunidad o por periodo pasa lo mismo.
 *
 * @param {object[]} grupos
 * @returns {object}
 */
export function totalizar(grupos = []) {
  const cero = {
    pacientes: 0,
    nuevos: 0,
    recurrentes: 0,
    porSexo: { hombres: 0, mujeres: 0 },
    porEdad: { menores: 0, adultos: 0, adultosMayores: 0 },
  };

  return grupos.reduce(
    (total, grupo) => ({
      pacientes: total.pacientes + grupo.pacientes,
      nuevos: total.nuevos + grupo.nuevos,
      recurrentes: total.recurrentes + grupo.recurrentes,
      porSexo: {
        hombres: total.porSexo.hombres + grupo.porSexo.hombres,
        mujeres: total.porSexo.mujeres + grupo.porSexo.mujeres,
      },
      porEdad: {
        menores: total.porEdad.menores + grupo.porEdad.menores,
        adultos: total.porEdad.adultos + grupo.porEdad.adultos,
        adultosMayores: total.porEdad.adultosMayores + grupo.porEdad.adultosMayores,
      },
    }),
    cero,
  );
}

/**
 * Pacientes atendidos, agregados por jornada, comunidad o mes, con su desglose por sexo y por
 * rango de edad y la distincion entre nuevos y recurrentes.
 *
 * Llama por RPC a fn_reporte_pacientes_atendidos (00067). La agregacion ocurre entera en la
 * base: el criterio 5 pide explicitamente no traerse todos los registros al cliente, y ademas
 * distinguir un paciente nuevo de uno recurrente exige mirar su historial completo, no solo las
 * atenciones del periodo consultado.
 *
 * La funcion devuelve unicamente agregados: ninguna fila identifica a un paciente. Es la misma
 * regla que fijo la 00054 al corregir la issue #407, y por eso el reporte puede abrirse a junta
 * directiva sin exponer filas clinicas.
 *
 * El chequeo de rol de aqui evita disparar una llamada que la propia funcion va a rechazar; la
 * barrera real es la guarda que fn_reporte_pacientes_atendidos lleva dentro.
 *
 * @param {object} [filtros]
 * @param {string} [filtros.rol] Rol de quien consulta.
 * @param {string} [filtros.agruparPor] Uno de AGRUPACIONES_DE_PACIENTES; por defecto jornada.
 * @param {string} [filtros.jornada] UUID de jornada.
 * @param {string} [filtros.comunidad] UUID de comunidad.
 * @param {string} [filtros.desde] Fecha ISO inicial.
 * @param {string} [filtros.hasta] Fecha ISO final.
 * @returns {Promise<{ grupos: object[], totales: object|null, error: object|null }>}
 */
export async function obtenerReportePacientesAtendidos({
  rol,
  agruparPor = AGRUPACIONES_DE_PACIENTES.JORNADA,
  jornada,
  comunidad,
  desde,
  hasta,
} = {}) {
  if (rol !== undefined && !puedeVerReporteDePacientes(rol)) {
    return {
      grupos: [],
      totales: null,
      error: {
        codigo: "SIN_PERMISO",
        mensaje: "Solo administracion y junta directiva consultan el reporte de pacientes.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_reporte_pacientes_atendidos", {
      p_agrupar_por: agruparPor,
      p_jornada_id: jornada || null,
      p_comunidad_id: comunidad || null,
      p_desde: desde || null,
      p_hasta: hasta || null,
    });

    if (error) return { grupos: [], totales: null, error: normalizarError(error) };

    const grupos = (data ?? []).map(aGrupo);
    return { grupos, totales: totalizar(grupos), error: null };
  } catch (error) {
    return { grupos: [], totales: null, error: normalizarError(error) };
  }
}
