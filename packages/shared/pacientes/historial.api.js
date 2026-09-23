import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
export { puedeVerHistorial } from "./permisos.js";
import { puedeVerHistorial } from "./permisos.js";
import { ESTADOS_RECETA } from "../enums.js";

export const TIPOS_DE_EVENTO = {
  TRIAJE: "triaje",
  CONSULTA: "consulta",
  RECETA: "receta",
  // El cierre de la atencion (00060) como evento propio: una atencion que se cerro sin triaje ni
  // consulta -el paciente se fue antes de pasar- no generaba ningun evento y desaparecia del
  // historial.
  CIERRE: "cierre",
};

// Un solo select con toda la profundidad: atenciones es el eje del que cuelgan triajes y
// consultas, y de consultas cuelgan diagnosticos y recetas. Pedirlo asi resuelve el historial
// en UNA llamada (criterio 3 de la issue) en vez de una consulta por tipo de evento.
const COLUMNAS_DEL_HISTORIAL = [
  "id",
  "jornadaId:jornada_id",
  "createdAt:created_at",
  // El cierre de la atencion (00060). Se pedia en atenciones/api.js para la cola de la jornada,
  // pero ninguna vista del paciente lo mostraba: una atencion que se cerro sin consulta -el
  // paciente se fue, se derivo- no dejaba rastro en su historial.
  "cerradaEn:cerrada_en",
  "motivoCierre:motivo_cierre",
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
    "id, createdAt:created_at, motivoConsulta:motivo_consulta, antecedentes, sintomas,",
    "exploracion, tratamiento, observaciones, planSeguimiento:plan_seguimiento,",
    "medicoId:medico_id,",
    "profesional:perfiles(nombres, apellidos),",
    "diagnosticos:consulta_diagnostico(id, esPrincipal:es_principal, diagnostico:diagnosticos(id, codigo, nombre)),",
    "recetas(id, folio, estado, createdAt:created_at,",
    "detalle:receta_detalle(cantidadEntregada:cantidad_entregada, cantidadAjustada:cantidad_ajustada,",
    "ajustadaEn:ajustada_en, ajustadaPorPerfil:perfiles(nombres, apellidos), dosis, frecuencia, duracion,",
    "medicamento:medicamentos(nombre, concentracion, presentacion:presentaciones(nombre))))",
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
      vinculoId: union.id ?? null,
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
      antecedentes: consulta.antecedentes ?? null,
      sintomas: consulta.sintomas ?? null,
      exploracion: consulta.exploracion ?? null,
      tratamiento: consulta.tratamiento ?? null,
      observaciones: consulta.observaciones ?? null,
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
        anulada: receta.estado === ESTADOS_RECETA.ANULADA,
        medicamentos: (receta.detalle ?? []).map((renglon) => ({
          medicamento: renglon.medicamento?.nombre ?? null,
          concentracion: renglon.medicamento?.concentracion ?? null,
          // presentacion:presentaciones(nombre) en el select llega anidado (00144): el embed de
          // PostgREST nunca se aplana solo.
          presentacion: renglon.medicamento?.presentacion?.nombre ?? null,
          cantidadEntregada: renglon.cantidadEntregada,
          cantidadAjustada: renglon.cantidadAjustada ?? null,
          ajustadaEn: renglon.ajustadaEn ?? null,
          ajustadaPorNombre: nombreDe(renglon.ajustadaPorPerfil),
          dosis: renglon.dosis,
          frecuencia: renglon.frecuencia,
          duracion: renglon.duracion,
        })),
      });
    }
  }

  if (atencion.cerradaEn) {
    eventos.push({
      ...comun,
      tipo: TIPOS_DE_EVENTO.CIERRE,
      id: `${atencion.id}-cierre`,
      fecha: atencion.cerradaEn,
      profesional: null,
      profesionalId: null,
      motivoCierre: atencion.motivoCierre ?? null,
    });
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
        mensaje: "Solo el personal médico y la administración pueden ver un historial clínico.",
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
 * Una atencion como UNA VISITA del historial clinico (issue #840, bloque F).
 *
 * aEventos() aplana la atencion en eventos sueltos -triaje, consulta, receta- que las pantallas
 * pintaban como tres cosas hermanas. La vision del bloque F es la contraria: cada visita es una
 * unidad, y trae DENTRO sus signos, su consulta y su receta. Esta funcion la arma con los mismos
 * datos, sin otra consulta a la base.
 *
 * Cada parte es opcional: una visita puede tener solo signos (los tomo un voluntario y el
 * paciente se fue), o consulta sin signos (no habia tensiometro), o consulta sin receta.
 *
 * @param {object} atencion Fila de atenciones con triajes y consultas embebidos.
 * @returns {object|null}
 */
export function aVisita(atencion) {
  if (!atencion) return null;

  const eventos = aEventos(atencion);
  const signos = eventos.find((evento) => evento.tipo === TIPOS_DE_EVENTO.TRIAJE) ?? null;
  const recetas = eventos.filter((evento) => evento.tipo === TIPOS_DE_EVENTO.RECETA);
  const consultas = eventos
    .filter((evento) => evento.tipo === TIPOS_DE_EVENTO.CONSULTA)
    .map((consulta) => ({
      ...consulta,
      recetas: recetas.filter((receta) => receta.consultaId === consulta.id),
    }));
  const [consulta = null] = consultas;
  const cierre = eventos.find((evento) => evento.tipo === TIPOS_DE_EVENTO.CIERRE) ?? null;

  return {
    atencionId: atencion.id,
    jornadaId: atencion.jornadaId ?? null,
    jornada: atencion.jornada?.nombre ?? null,
    comunidad: atencion.jornada?.comunidad?.nombre ?? null,
    fecha: atencion.jornada?.fecha ?? atencion.createdAt ?? null,
    iniciadaEn: atencion.createdAt ?? null,
    // Los signos con el id del triaje: la correccion los actualiza por ese id.
    signos: signos ? { id: signos.id, ...signos.signos } : null,
    signosTomadosPor: signos?.profesional ?? null,
    // Casi siempre hay una sola consulta por atencion. `consulta` es la primera, que es la que se
    // edita desde la visita; `consultas` las conserva todas para no esconder ninguna.
    consulta,
    consultas,
    recetas,
    profesional: consulta?.profesional ?? signos?.profesional ?? null,
    diagnosticoPrincipal: consulta?.diagnosticoPrincipal ?? null,
    cerradaEn: atencion.cerradaEn ?? null,
    motivoCierre: cierre?.motivoCierre ?? null,
  };
}

/**
 * Las visitas de un paciente, de la mas reciente a la mas antigua. Mismas columnas, mismo filtro
 * de periodo y mismo chequeo de rol que obtenerHistorialMedico(): es el mismo historial, contado
 * por visita en vez de por evento.
 *
 * @param {string} pacienteId
 * @param {{ rol?: string, desde?: string, hasta?: string, jornadaId?: string }} [opciones]
 *   `jornadaId` acota a la visita de esa jornada: atenciones es UNIQUE (paciente, jornada), asi
 *   que hay a lo sumo una.
 * @returns {Promise<{ visitas: object[], error: object|null }>}
 */
export async function obtenerVisitasDePaciente(pacienteId, { rol, desde, hasta, jornadaId } = {}) {
  if (!pacienteId) return { visitas: [], error: null };

  if (rol !== undefined && !puedeVerHistorial(rol)) {
    return { visitas: [], error: null };
  }

  try {
    let consulta = obtenerSupabase()
      .from("atenciones")
      .select(COLUMNAS_DEL_HISTORIAL)
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });

    if (jornadaId) consulta = consulta.eq("jornada_id", jornadaId);
    if (desde) consulta = consulta.gte("created_at", desde);
    if (hasta) consulta = consulta.lte("created_at", hasta);

    const { data, error } = await consulta;
    if (error) return { visitas: [], error: normalizarError(error) };

    return { visitas: (data ?? []).map(aVisita), error: null };
  } catch (error) {
    return { visitas: [], error: normalizarError(error) };
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
