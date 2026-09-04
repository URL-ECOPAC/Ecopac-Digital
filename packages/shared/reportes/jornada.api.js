// Reporte de resultados de una jornada (issue #489).
//
// La version anterior consultaba un esquema que nunca existio: jornadas.lugar no es una
// columna (el lugar es comunidad_id -> comunidades, 00012/00008), consultas no tiene
// atendido_por/diagnostico/pacientes_id (son medico_id, el diagnostico vive en la tabla puente
// consulta_diagnostico -> diagnosticos, y el paciente se alcanza via expediente_id ->
// expedientes.paciente_id, 00018/00009), y la tabla de renglones de receta es receta_detalle en
// singular, sin consulta_id propia: el salto real es consultas -> recetas (recetas.consulta_id)
// -> receta_detalle (receta_detalle.receta_id), con cantidad_entregada y el nombre embebido
// desde medicamentos.nombre (00019).
//
// La guarda de rol es el espejo exacto de las politicas RLS de esas tablas
// (00033_politicas_rls_atenciones_consultas_recetas.sql): solo administrador y medico tienen
// SELECT sobre consultas/consulta_diagnostico/diagnosticos/recetas/receta_detalle. La 00054
// retiro a proposito las politicas que dejaban a junta directiva y socio fundador leer estas
// mismas tablas para reportes (issue #407): esta funcion agrega filas clinicas crudas en JS
// (diagnostico y medico por fila) antes de resumirlas, que es justo lo que esa decision prohibe
// exponerle a un rol consultivo aunque el resultado final solo muestre agregados. Por eso la
// guarda no es esConsultivo() (ese patron es para reportes/api.js, que lee una vista ya
// agregada en la base): aqui solo administrador o medico pasan.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

// La guarda se declara en permisos.js, como las de impacto y pacientes (issue #693). Aqui se
// reexporta el mismo binding para no romper lo que ya la importa desde este archivo: reexportar
// es seguro, declararla dos veces no -- el barril la recibiria por dos estrellas y ESM la
// excluiria del namespace por ambigua, que es el bug #365.
export { puedeVerReporteJornada } from "./permisos.js";
import { puedeVerReporteJornada } from "./permisos.js";

/** Cuenta ocurrencias de una clave no vacia y devuelve las entradas ordenadas de mayor a menor. */
function contarFrecuencias(valores, nombreDeCampo) {
  const conteo = {};
  for (const valor of valores) {
    if (!valor) continue;
    conteo[valor] = (conteo[valor] || 0) + 1;
  }

  return Object.entries(conteo)
    .map(([clave, cantidad]) => ({ [nombreDeCampo]: clave, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export async function obtenerReporteJornada({ jornadaId, rol } = {}) {
  if (!jornadaId) {
    return {
      datos: null,
      error: { codigo: "CAMPO_REQUERIDO", mensaje: "El ID de la jornada es obligatorio." },
    };
  }

  if (!puedeVerReporteJornada(rol)) {
    return {
      datos: null,
      error: {
        codigo: "SIN_PERMISO",
        mensaje: "Solo administracion y medico consultan el reporte de resultados de la jornada.",
      },
    };
  }

  try {
    const supabase = obtenerSupabase();

    const { data: jornada, error: errorJornada } = await supabase
      .from("jornadas")
      .select("id, nombre, fecha, estado, comunidad:comunidades(id, nombre)")
      .eq("id", jornadaId)
      .single();

    if (errorJornada) throw errorJornada;

    const { data: consultas, error: errorConsultas } = await supabase
      .from("consultas")
      .select(
        `
        id,
        medico_id,
        expedientes ( paciente_id ),
        consulta_diagnostico ( diagnosticos ( nombre ) )
        `,
      )
      .eq("jornada_id", jornadaId);

    if (errorConsultas) throw errorConsultas;

    const filasDeConsultas = consultas ?? [];
    const totalConsultas = filasDeConsultas.length;

    const pacientesUnicos = new Set(
      filasDeConsultas.map((c) => c.expedientes?.paciente_id).filter(Boolean),
    ).size;

    const nombresDeDiagnosticos = filasDeConsultas.flatMap(
      (c) => c.consulta_diagnostico?.map((cd) => cd.diagnosticos?.nombre) ?? [],
    );
    const diagnosticosMasFrecuentes = contarFrecuencias(nombresDeDiagnosticos, "diagnostico");

    const personalParticipante = contarFrecuencias(
      filasDeConsultas.map((c) => c.medico_id),
      "usuario_id",
    ).map(({ usuario_id, cantidad }) => ({ usuario_id, total_atenciones: cantidad }));

    const consultaIds = filasDeConsultas.map((c) => c.id);
    let medicamentosEntregados = [];

    if (consultaIds.length > 0) {
      const { data: recetas, error: errorRecetas } = await supabase
        .from("recetas")
        .select(
          `
          id,
          consulta_id,
          receta_detalle ( cantidad_entregada, medicamentos ( nombre ) )
          `,
        )
        .in("consulta_id", consultaIds);

      if (errorRecetas) throw errorRecetas;

      const conteoMedicamentos = {};
      for (const receta of recetas ?? []) {
        for (const renglon of receta.receta_detalle ?? []) {
          const nombre = renglon.medicamentos?.nombre ?? "Sin nombre";
          conteoMedicamentos[nombre] =
            (conteoMedicamentos[nombre] || 0) + Number(renglon.cantidad_entregada || 0);
        }
      }

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
    return { datos: null, error: normalizarError(error) };
  }
}
