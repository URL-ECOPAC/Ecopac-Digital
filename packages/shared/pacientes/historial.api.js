import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
export { puedeVerHistorial } from "./permisos.js";
import { puedeVerHistorial } from "./permisos.js";

export const TIPOS_DE_EVENTO = {
  TRIAJE: "triaje",
  CONSULTA: "consulta",
  RECETA: "receta",
};

// Un solo select con toda la profundidad: atenciones es el eje del que cuelgan triajes y
// consultas, y de consultas cuelgan diagnosticos y recetas. Pedirlo asi resuelve el historial
// en UNA llamada (criterio 3 de la issue) en vez de una consulta por tipo de evento.
const COLUMNAS_DEL_HISTORIAL = [
  "id",
  "jornadaId:jornada_id",
  "createdAt:created_at",
  "jornada:jornadas(nombre, fecha, comunidad:comunidades(nombre))",
  [
    "triajes(",
    "id, tomadoEn:tomado_en, tomadoPor:tomado_por,",
    "presionSistolica:presion_sistolica, presionDiastolica:presion_diastolica,",
    "glucosa, peso, talla, temperatura, frecuenciaCardiaca:frecuencia_cardiaca, imc,",
    "profesional:perfiles(nombres, apellidos)",
    ")",
  ].join(" "),
  [
    "consultas(",
    "id, createdAt:created_at, motivoConsulta:motivo_consulta, tratamiento,",
    "planSeguimiento:plan_seguimiento, medicoId:medico_id,",
    "profesional:perfiles(nombres, apellidos),",
    "diagnosticos:consulta_diagnostico(esPrincipal:es_principal, diagnostico:diagnosticos(id, codigo, nombre)),",
    "recetas(id, folio, estado, createdAt:created_at,",
    "detalle:receta_detalle(cantidadEntregada:cantidad_entregada, dosis, frecuencia, duracion,",
    "medicamento:medicamentos(nombre, concentracion, presentacion)))",
    ")",
  ].join(" "),
].join(", ");

function nombreDe(perfil) {
  if (!perfil) return null;
  return [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ").trim() || null;
}

/**
 * Aplana una atencion en los eventos que la componen.
 *
 * Cada evento lleva su propia fecha, la jornada en la que ocurrio y quien lo registro
 * (criterio 2), para que la pantalla no tenga que subir por el arbol a buscarlos.
 *
 * @param {object} atencion Fila de atenciones con triajes y consultas embebidos.
 * @returns {object[]}
 */
export function aEventos(atencion) {
  if (!atencion) return [];

  const jornada = atencion.jornada?.nombre ?? null;
  const fechaDeJornada = atencion.jornada?.fecha ?? null;
  const comunidad = atencion.jornada?.comunidad?.nombre ?? null;
  const comun = {
    atencionId: atencion.id,
    jornadaId: atencion.jornadaId,
    jornada,
    fechaDeJornada,
    comunidad,
  };
  const eventos = [];

  // triajes_atencion_id_key (migracion 00013) hace de atencion_id -> triaje una relacion 1:1, asi
  // que PostgREST lo embebe como un objeto (o null), no como arreglo -- a diferencia de
  // consultas, que si puede tener varias filas por atencion.
  const triaje = atencion.triajes;
  if (triaje) {
    eventos.push({
      ...comun,
      tipo: TIPOS_DE_EVENTO.TRIAJE,
      id: triaje.id,
      fecha: triaje.tomadoEn ?? atencion.createdAt,
      profesional: nombreDe(triaje.profesional),
      profesionalId: triaje.tomadoPor ?? null,
      signos: {
        presionSistolica: triaje.presionSistolica ?? null,
        presionDiastolica: triaje.presionDiastolica ?? null,
        glucosa: triaje.glucosa ?? null,
        peso: triaje.peso ?? null,
        talla: triaje.talla ?? null,
        temperatura: triaje.temperatura ?? null,
        frecuenciaCardiaca: triaje.frecuenciaCardiaca ?? null,
        imc: triaje.imc ?? null,
      },
    });
  }

  for (const consulta of atencion.consultas ?? []) {
    const diagnosticos = (consulta.diagnosticos ?? []).map((union) => ({
      id: union.diagnostico?.id ?? null,
      codigo: union.diagnostico?.codigo ?? null,
      nombre: union.diagnostico?.nombre ?? null,
      esPrincipal: union.esPrincipal === true,
    }));

    eventos.push({
      ...comun,
      tipo: TIPOS_DE_EVENTO.CONSULTA,
      id: consulta.id,
      fecha: consulta.createdAt,
      profesional: nombreDe(consulta.profesional),
      profesionalId: consulta.medicoId ?? null,
      motivoConsulta: consulta.motivoConsulta ?? null,
      tratamiento: consulta.tratamiento ?? null,
      planSeguimiento: consulta.planSeguimiento ?? null,
      diagnosticos,
      diagnosticoPrincipal: diagnosticos.find((uno) => uno.esPrincipal) ?? null,
    });

    // Las recetas se emiten dentro de una consulta, pero son un evento propio de la linea de
    // tiempo: al medico le importa "que se le entrego y cuando", no solo "que se le diagnostico".
    for (const receta of consulta.recetas ?? []) {
      eventos.push({
        ...comun,
        tipo: TIPOS_DE_EVENTO.RECETA,
        id: receta.id,
        fecha: receta.createdAt ?? consulta.createdAt,
        profesional: nombreDe(consulta.profesional),
        profesionalId: consulta.medicoId ?? null,
        consultaId: consulta.id,
        folio: receta.folio ?? null,
        anulada: receta.estado === "anulada",
        medicamentos: (receta.detalle ?? []).map((renglon) => ({
          medicamento: renglon.medicamento?.nombre ?? null,
          concentracion: renglon.medicamento?.concentracion ?? null,
          presentacion: renglon.medicamento?.presentacion ?? null,
          cantidadEntregada: renglon.cantidadEntregada,
          dosis: renglon.dosis,
          frecuencia: renglon.frecuencia,
          duracion: renglon.duracion,
        })),
      });
    }
  }

  return eventos;
}

/**
 * Ordena los eventos del mas reciente al mas antiguo. Un evento sin fecha legible se va al
 * final en vez de romper el orden del resto.
 *
 * @param {object[]} eventos
 * @returns {object[]}
 */
export function ordenarCronologicamente(eventos = []) {
  return [...eventos].sort((uno, otro) => {
    const a = Date.parse(uno.fecha ?? "");
    const b = Date.parse(otro.fecha ?? "");
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return b - a;
  });
}

/**
 * Linea de tiempo clinica de un paciente: triajes, consultas con sus diagnosticos, y recetas
 * con lo que se entrego, todo ordenado cronologicamente.
 *
 * Se resuelve en UNA sola llamada (criterio 3): `atenciones` es el eje del que cuelgan triajes
 * y consultas, y de consultas cuelgan diagnosticos y recetas, asi que PostgREST puede traerlo
 * todo embebido. Despues se aplana aqui, que es trabajo de CPU y no de red.
 *
 * `desde` y `hasta` acotan por periodo (criterio 4): un paciente cronico con anios de
 * atenciones no se trae entero cada vez que se abre su ficha. Sin ellos devuelve todo.
 *
 * El chequeo de `rol` es para que la pantalla no dispare una consulta que sabe que volvera
 * vacia, no una barrera de seguridad: quien decide de verdad son las politicas de la 00033, que
 * solo dejan leer consultas y recetas a administrador y medico. Mismo criterio que
 * obtenerIndicadoresImpacto() en reportes/api.js.
 *
 * @param {string} pacienteId UUID del paciente.
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien consulta, para el chequeo previo.
 * @param {string} [opciones.desde] Fecha ISO inicial del periodo.
 * @param {string} [opciones.hasta] Fecha ISO final del periodo.
 * @returns {Promise<{ eventos: object[], error: object|null }>}
 */
export async function obtenerHistorialMedico(pacienteId, { rol, desde, hasta, limite } = {}) {
  if (!pacienteId) return { eventos: [], atenciones: 0, error: null };

  if (rol !== undefined && !puedeVerHistorial(rol)) {
    return {
      eventos: [],
      atenciones: 0,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
        mensaje: "Solo el personal medico y la administracion pueden ver un historial clinico.",
      },
    };
  }

  try {
    let consulta = obtenerSupabase()
      .from("atenciones")
      .select(COLUMNAS_DEL_HISTORIAL)
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });

    if (desde) consulta = consulta.gte("created_at", desde);
    if (hasta) consulta = consulta.lte("created_at", hasta);
    if (limite) consulta = consulta.limit(limite);

    const { data, error } = await consulta;

    if (error) return { eventos: [], atenciones: 0, error: normalizarError(error) };

    const filas = data ?? [];
    const eventos = filas.flatMap(aEventos);
    return { eventos: ordenarCronologicamente(eventos), atenciones: filas.length, error: null };
  } catch (error) {
    return { eventos: [], atenciones: 0, error: normalizarError(error) };
  }
}

/**
 * La atencion mas reciente de un paciente (issue #123), para mostrarla en el resumen de su
 * ficha sin traer el historial completo.
 *
 * Reusa las mismas columnas y el mismo aplanado que obtenerHistorialMedico(): la diferencia es
 * el `.limit(1)` sobre `atenciones`, que evita traer anios de historial solo para quedarse con
 * el primer evento. El chequeo de rol es el mismo (puedeVerHistorial), y por la misma razon: no
 * es una barrera de seguridad, es no disparar una consulta que RLS va a vaciar.
 *
 * @param {string} pacienteId UUID del paciente.
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien consulta, para el chequeo previo.
 * @returns {Promise<{ ultimaAtencion: object|null, error: object|null }>}
 */
export async function obtenerUltimaAtencion(pacienteId, { rol } = {}) {
  if (!pacienteId) return { ultimaAtencion: null, error: null };

  if (rol !== undefined && !puedeVerHistorial(rol)) {
    return { ultimaAtencion: null, error: null };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("atenciones")
      .select(COLUMNAS_DEL_HISTORIAL)
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return { ultimaAtencion: null, error: normalizarError(error) };

    const eventos = ordenarCronologicamente((data ?? []).flatMap(aEventos));
    return { ultimaAtencion: eventos[0] ?? null, error: null };
  } catch (error) {
    return { ultimaAtencion: null, error: normalizarError(error) };
  }
}
