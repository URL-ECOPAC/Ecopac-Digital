import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

const ROLES_PERMITIDOS = ["administrador", "junta_directiva"];

/**
 * Consulta los indicadores de impacto desde la vista consolidada.
 */
export async function obtenerIndicadoresImpacto({
  rol,
  agruparPor,
  periodo,
  periodoComparacion,
  comunidad_id,
  jornada_id,
  proyecto_id,
} = {}) {
  // Validación previa de permisos
  if (!rol || !ROLES_PERMITIDOS.includes(rol)) {
    return {
      datos: null,
      error: {
        mensaje: "No tienes permisos para consultar los indicadores de impacto.",
      },
    };
  }

  try {
    const supabase = obtenerSupabase();

    const consultarPeriodo = async (rangoFechas) => {
      let query = supabase.from("vista_indicadores_impacto").select(`
        pacientes_atendidos,
        comunidades_beneficiadas,
        tratamientos_entregados,
        medicamentos_utilizados,
        mes,
        comunidad_id,
        jornada_id,
        proyecto_id
      `);

      if (rangoFechas?.fecha_inicio) {
        query = query.gte("fecha", rangoFechas.fecha_inicio);
      }
      if (rangoFechas?.fecha_fin) {
        query = query.lte("fecha", rangoFechas.fecha_fin);
      }
      if (comunidad_id) {
        query = query.eq("comunidad_id", comunidad_id);
      }
      if (jornada_id) {
        query = query.eq("jornada_id", jornada_id);
      }
      if (proyecto_id) {
        query = query.eq("proyecto_id", proyecto_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    };

    const registrosPeriodoActual = await consultarPeriodo(periodo);

    const totales = registrosPeriodoActual.reduce(
      (acc, curr) => ({
        pacientes_atendidos: acc.pacientes_atendidos + (curr.pacientes_atendidos || 0),
        comunidades_beneficiadas: acc.comunidades_beneficiadas + (curr.comunidades_beneficiadas || 0),
        tratamientos_entregados: acc.tratamientos_entregados + (curr.tratamientos_entregados || 0),
        medicamentos_utilizados: acc.medicamentos_utilizados + (curr.medicamentos_utilizados || 0),
      }),
      {
        pacientes_atendidos: 0,
        comunidades_beneficiadas: 0,
        tratamientos_entregados: 0,
        medicamentos_utilizados: 0,
      }
    );

    let datosAgrupados = [];
    if (agruparPor) {
      const mapaAgrupado = new Map();

      registrosPeriodoActual.forEach((reg) => {
        const claveAgrupacion = reg[agruparPor] || "sin_clasificar";
        if (!mapaAgrupado.has(claveAgrupacion)) {
          mapaAgrupado.set(claveAgrupacion, {
            grupo: claveAgrupacion,
            pacientes_atendidos: 0,
            comunidades_beneficiadas: 0,
            tratamientos_entregados: 0,
            medicamentos_utilizados: 0,
          });
        }

        const acumulado = mapaAgrupado.get(claveAgrupacion);
        acumulado.pacientes_atendidos += reg.pacientes_atendidos || 0;
        acumulado.comunidades_beneficiadas += reg.comunidades_beneficiadas || 0;
        acumulado.tratamientos_entregados += reg.tratamientos_entregados || 0;
        acumulado.medicamentos_utilizados += reg.medicamentos_utilizados || 0;
      });

      datosAgrupados = Array.from(mapaAgrupado.values());
    }

    let comparacion = null;
    if (periodoComparacion) {
      const registrosPeriodoAnterior = await consultarPeriodo(periodoComparacion);

      const totalesAnteriores = registrosPeriodoAnterior.reduce(
        (acc, curr) => ({
          pacientes_atendidos: acc.pacientes_atendidos + (curr.pacientes_atendidos || 0),
          comunidades_beneficiadas: acc.comunidades_beneficiadas + (curr.comunidades_beneficiadas || 0),
          tratamientos_entregados: acc.tratamientos_entregados + (curr.tratamientos_entregados || 0),
          medicamentos_utilizados: acc.medicamentos_utilizados + (curr.medicamentos_utilizados || 0),
        }),
        {
          pacientes_atendidos: 0,
          comunidades_beneficiadas: 0,
          tratamientos_entregados: 0,
          medicamentos_utilizados: 0,
        }
      );

      const calcularVariacion = (actual, anterior) => {
        const diferencia = actual - anterior;
        const porcentaje = anterior === 0 ? (actual > 0 ? 100 : 0) : Number(((diferencia / anterior) * 100).toFixed(2));
        return { actual, anterior, diferencia, porcentaje };
      };

      comparacion = {
        totalesAnteriores,
        variacion: {
          pacientes_atendidos: calcularVariacion(totales.pacientes_atendidos, totalesAnteriores.pacientes_atendidos),
          comunidades_beneficiadas: calcularVariacion(totales.comunidades_beneficiadas, totalesAnteriores.comunidades_beneficiadas),
          tratamientos_entregados: calcularVariacion(totales.tratamientos_entregados, totalesAnteriores.tratamientos_entregados),
          medicamentos_utilizados: calcularVariacion(totales.medicamentos_utilizados, totalesAnteriores.medicamentos_utilizados),
        },
      };
    }

    return {
      datos: {
        totales,
        agrupados: datosAgrupados,
        comparacion,
      },
      error: null,
    };
  } catch (error) {
    return normalizarError(error);
  }
}