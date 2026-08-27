import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

export async function obtenerReporteJornada(jornadaId) {
  if (!jornadaId) {
    return {
      datos: null,
      error: { mensaje: "El ID de la jornada es obligatorio." },
    };
  }

  try {
    const supabase = obtenerSupabase();

    // 1. Obtener cabecera de jornada
    const { data: jornada, error: errorJornada } = await supabase
      .from("jornadas")
      .select("id, nombre, fecha, lugar, estado")
      .eq("id", jornadaId)
      .single();

    if (errorJornada) throw errorJornada;

    // 2. Consultas
    const { data: consultas, error: errorConsultas } = await supabase
      .from("consultas")
      .select("id, atendido_por, diagnostico, pacientes_id")
      .eq("jornada_id", jornadaId);

    if (errorConsultas) throw errorConsultas;

    const totalConsultas = consultas ? consultas.length : 0;
    const pacientesUnicos = new Set(
      consultas?.map((c) => c.pacientes_id).filter(Boolean)
    ).size;

    // 3. Diagnósticos
    const conteoDiagnosticos = {};
    consultas?.forEach((c) => {
      if (c.diagnostico) {
        conteoDiagnosticos[c.diagnostico] = (conteoDiagnosticos[c.diagnostico] || 0) + 1;
      }
    });

    const diagnosticosMasFrecuentes = Object.entries(conteoDiagnosticos)
      .map(([diagnostico, cantidad]) => ({ diagnostico, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // 4. Personal
    const conteoPersonal = {};
    consultas?.forEach((c) => {
      if (c.atendido_por) {
        conteoPersonal[c.atendido_por] = (conteoPersonal[c.atendido_por] || 0) + 1;
      }
    });

    const personalParticipante = Object.entries(conteoPersonal).map(
      ([usuario_id, total_atenciones]) => ({ usuario_id, total_atenciones })
    );

    // 5. Medicamentos
    const consultaIds = consultas?.map((c) => c.id) || [];
    let medicamentosEntregados = [];

    if (consultaIds.length > 0) {
      const { data: medicamentos, error: errorMeds } = await supabase
        .from("recetas_detalle")
        .select("medicamento_id, medicamento_nombre, cantidad")
        .in("consulta_id", consultaIds);

      if (errorMeds) throw errorMeds;

      const conteoMedicamentos = {};
      medicamentos?.forEach((m) => {
        const key = m.medicamento_nombre || m.medicamento_id;
        conteoMedicamentos[key] = (conteoMedicamentos[key] || 0) + Number(m.cantidad || 1);
      });

      medicamentosEntregados = Object.entries(conteoMedicamentos)
        .map(([medicamento, cantidad]) => ({ medicamento, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
    }

    return {
      datos: {
        jornada,
        resumen: {
          total_consultas: totalConsultas,
          pacientes_atendidos: pacientesUnicos,
        },
        diagnosticos_mas_frecuentes: diagnosticosMasFrecuentes,
        medicamentos_mas_entregados: medicamentosEntregados,
        personal_participante: personalParticipante,
      },
      error: null,
    };
  } catch (error) {
    return normalizarError(error);
  }
}