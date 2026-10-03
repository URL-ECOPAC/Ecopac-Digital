// Consultas de Supabase de la agenda de citas (issue #927, 00184).
//
// Todas devuelven `{ ..., error }` en vez de lanzar, con la clave de cada una: `citas`, `cita`,
// `jornadas`, `profesionales`, `cantidad`. Las reglas las hace cumplir fn_validar_cita; el espejo
// del cliente esta en validaciones.js y se alimenta de citasQueSeCruzan().
//
// Los nombres de los profesionales salen de nombres_de_perfiles (00161), no de perfiles: un medico o
// un voluntario no leen el perfil de otra persona, y la agenda tiene que decir quien atiende.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { ESTADOS_JORNADA } from "../enums.js";
import { normalizarTexto } from "../validations/index.js";
import { ESTADOS_CITA } from "./estados.js";
import { motivoDeCancelacion } from "./validaciones.js";

const COLUMNAS_DE_LA_CITA = [
  "id",
  "pacienteId:paciente_id",
  "jornadaId:jornada_id",
  "clinicaId:clinica_id",
  "areaId:area_id",
  "profesionalId:profesional_id",
  "iniciaEn:inicia_en",
  "terminaEn:termina_en",
  "estado",
  "notas",
  "canceladaEn:cancelada_en",
  "motivoCancelacion:motivo_cancelacion",
  "paciente:pacientes(nombres, apellidos)",
  "jornada:jornadas(nombre, fecha, estado)",
  "clinica:clinicas(nombre, salasDisponibles:salas_disponibles)",
  "area:areas_atencion(nombre)",
  "profesional:nombres_de_perfiles!citas_profesional_id_fkey(nombres, apellidos)",
  "consulta:consultas(id)",
].join(", ");

/** Lo minimo para el espejo de cupo y traslape. */
const COLUMNAS_DE_OCUPACION = [
  "id",
  "pacienteId:paciente_id",
  "clinicaId:clinica_id",
  "profesionalId:profesional_id",
  "iniciaEn:inicia_en",
  "terminaEn:termina_en",
  "estado",
].join(", ");

function nombreDe(persona) {
  const nombre = [persona?.nombres, persona?.apellidos].filter(Boolean).join(" ").trim();
  return nombre || null;
}

/** Como queda una cita en el cliente. */
export function aCita(fila) {
  if (!fila) return null;
  const consulta = Array.isArray(fila.consulta) ? fila.consulta[0] : fila.consulta;
  return {
    id: fila.id,
    pacienteId: fila.pacienteId,
    jornadaId: fila.jornadaId,
    clinicaId: fila.clinicaId,
    areaId: fila.areaId,
    profesionalId: fila.profesionalId ?? null,
    iniciaEn: fila.iniciaEn,
    terminaEn: fila.terminaEn,
    estado: fila.estado,
    notas: fila.notas ?? null,
    canceladaEn: fila.canceladaEn ?? null,
    motivoCancelacion: fila.motivoCancelacion ?? null,
    paciente: nombreDe(fila.paciente),
    jornada: fila.jornada?.nombre ?? null,
    fechaDeJornada: fila.jornada?.fecha ?? null,
    estadoDeJornada: fila.jornada?.estado ?? null,
    clinica: fila.clinica?.nombre ?? null,
    salasDeLaClinica: fila.clinica ? Number(fila.clinica.salasDisponibles) : null,
    area: fila.area?.nombre ?? null,
    profesional: nombreDe(fila.profesional),
    consultaId: consulta?.id ?? null,
  };
}

/** Los mensajes de fn_validar_cita que se muestran tal cual (sin la tilde que la base no lleva). */
const MENSAJES_DE_LA_BASE = [
  ["El paciente ya tiene otra cita a esa hora", "El paciente ya tiene otra cita a esa hora."],
  ["El profesional ya tiene otra cita a esa hora", "El profesional ya tiene otra cita a esa hora."],
  ["salas ocupadas", "La clínica ya tiene todas sus salas ocupadas a esa hora."],
  [
    "cuadro de turnos de la jornada",
    "El profesional tiene que estar como médico en el cuadro de turnos de la jornada.",
  ],
  ["Solo se agenda en una jornada planificada o en curso", "La jornada ya no admite citas."],
  ["antes de la fecha de la jornada", "La cita no puede ser antes de la fecha de la jornada."],
  ["dado de baja", "El paciente está dado de baja: no se le agendan citas."],
  ["La clinica esta retirada", "La clínica está retirada: no se agenda en ella."],
  ["El area esta retirada", "El área está retirada: no se agenda en ella."],
  ["con la jornada en curso", "Una cita se atiende con la jornada en curso."],
  ["Solo se cambia la agenda de una cita creada", "Solo se reagenda una cita creada."],
  ["ya no se edita", "Esta cita ya no se edita; solo sus notas."],
];

/**
 * El error de escribir una cita, con el mensaje de la regla que fallo si es una de fn_validar_cita.
 * normalizarError lo deja generico; el texto de la base viaja en `detalle`.
 *
 * @param {{ codigo?: string, mensaje?: string, detalle?: string }|null} error
 * @returns {object|null}
 */
export function errorDeCita(error) {
  if (!error) return null;
  const detalle = String(error.detalle ?? "");
  const conocido = MENSAJES_DE_LA_BASE.find(([clave]) => detalle.includes(clave));
  return conocido ? { ...error, mensaje: conocido[1] } : error;
}

function sinPermiso(mensaje) {
  return { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO), mensaje };
}

/**
 * Las citas de un rango de tiempo, con filtros opcionales. Un filtro vacio no se aplica.
 *
 * @param {{ desde?: string, hasta?: string, jornadaId?: string, clinicaId?: string,
 *   areaId?: string, profesionalId?: string, estado?: string, pacienteId?: string }} [filtros]
 * @returns {Promise<{ citas: object[], error: object|null }>}
 */
export async function listarCitas(filtros = {}) {
  try {
    let consulta = obtenerSupabase().from("citas").select(COLUMNAS_DE_LA_CITA);
    if (filtros.desde) consulta = consulta.gte("inicia_en", filtros.desde);
    if (filtros.hasta) consulta = consulta.lt("inicia_en", filtros.hasta);
    if (filtros.jornadaId) consulta = consulta.eq("jornada_id", filtros.jornadaId);
    if (filtros.clinicaId) consulta = consulta.eq("clinica_id", filtros.clinicaId);
    if (filtros.areaId) consulta = consulta.eq("area_id", filtros.areaId);
    if (filtros.profesionalId) consulta = consulta.eq("profesional_id", filtros.profesionalId);
    if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
    if (filtros.pacienteId) consulta = consulta.eq("paciente_id", filtros.pacienteId);

    const { data, error } = await consulta.order("inicia_en", { ascending: true });
    if (error) return { citas: [], error: normalizarError(error) };
    return { citas: (data ?? []).map(aCita), error: null };
  } catch (error) {
    return { citas: [], error: normalizarError(error) };
  }
}

/**
 * Una cita.
 *
 * @param {string} id
 * @returns {Promise<{ cita: object|null, error: object|null }>}
 */
export async function obtenerCita(id) {
  if (!id) return { cita: null, error: null };
  try {
    const { data, error } = await obtenerSupabase()
      .from("citas")
      .select(COLUMNAS_DE_LA_CITA)
      .eq("id", id)
      .maybeSingle();
    if (error) return { cita: null, error: normalizarError(error) };
    return { cita: aCita(data), error: null };
  } catch (error) {
    return { cita: null, error: normalizarError(error) };
  }
}

/**
 * Las citas no canceladas que se cruzan con un intervalo, del paciente, del profesional o de la
 * clinica: lo que el espejo de validaciones.js necesita para avisar antes de guardar. Ve lo que la
 * RLS deja ver; la base cuenta todas.
 *
 * @param {{ iniciaEn: string, terminaEn: string, pacienteId?: string, profesionalId?: string|null,
 *   clinicaId?: string }} criterio
 * @returns {Promise<{ citas: object[], error: object|null }>}
 */
export async function citasQueSeCruzan({
  iniciaEn,
  terminaEn,
  pacienteId,
  profesionalId,
  clinicaId,
}) {
  const quienes = [
    pacienteId ? `paciente_id.eq.${pacienteId}` : null,
    profesionalId ? `profesional_id.eq.${profesionalId}` : null,
    clinicaId ? `clinica_id.eq.${clinicaId}` : null,
  ].filter(Boolean);
  if (!iniciaEn || !terminaEn || quienes.length === 0) return { citas: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("citas")
      .select(COLUMNAS_DE_OCUPACION)
      .neq("estado", ESTADOS_CITA.CANCELADA)
      .lt("inicia_en", terminaEn)
      .gt("termina_en", iniciaEn)
      .or(quienes.join(","));
    if (error) return { citas: [], error: normalizarError(error) };
    return { citas: data ?? [], error: null };
  } catch (error) {
    return { citas: [], error: normalizarError(error) };
  }
}

/** Las columnas que se escriben, desde el formulario. */
function aColumnasDeLaCita(datos) {
  const fila = {};
  const copiar = (clave, columna, transformar = (valor) => valor) => {
    if (Object.prototype.hasOwnProperty.call(datos, clave))
      fila[columna] = transformar(datos[clave]);
  };
  copiar("pacienteId", "paciente_id");
  copiar("jornadaId", "jornada_id");
  copiar("clinicaId", "clinica_id");
  copiar("areaId", "area_id");
  copiar("profesionalId", "profesional_id", (valor) => valor || null);
  copiar("iniciaEn", "inicia_en");
  copiar("terminaEn", "termina_en");
  copiar("notas", "notas", (valor) => normalizarTexto(valor ?? "") || null);
  return fila;
}

async function escribirCita(peticion, mensajeSinFila) {
  try {
    const { data, error } = await peticion.select(COLUMNAS_DE_LA_CITA).maybeSingle();
    if (error) return { cita: null, error: errorDeCita(normalizarError(error)) };
    if (!data) return { cita: null, error: sinPermiso(mensajeSinFila) };
    return { cita: aCita(data), error: null };
  } catch (error) {
    return { cita: null, error: normalizarError(error) };
  }
}

/**
 * Agenda una cita. Los datos ya vienen validados (useFormularioCita).
 *
 * @param {{ pacienteId: string, jornadaId: string, clinicaId: string, areaId: string,
 *   profesionalId?: string|null, iniciaEn: string, terminaEn: string, notas?: string }} datos
 * @returns {Promise<{ cita: object|null, error: object|null }>}
 */
export async function crearCita(datos) {
  return escribirCita(
    obtenerSupabase().from("citas").insert(aColumnasDeLaCita(datos)),
    "No se pudo agendar la cita. Revisa tus permisos y la jornada.",
  );
}

/**
 * Cambia la agenda o las notas de una cita.
 *
 * @param {string} id
 * @param {object} cambios Mismas claves que crearCita, todas opcionales.
 * @returns {Promise<{ cita: object|null, error: object|null }>}
 */
export async function actualizarCita(id, cambios = {}) {
  if (!id) return { cita: null, error: sinPermiso("Hace falta el id de la cita.") };
  return escribirCita(
    obtenerSupabase().from("citas").update(aColumnasDeLaCita(cambios)).eq("id", id),
    "No se pudo guardar la cita. Revisa tus permisos.",
  );
}

/**
 * Cambia el estado: a en_atencion (Atender), de vuelta a creada, o a cancelada con su motivo.
 * Atendida no: la pone la consulta.
 *
 * @param {string} id
 * @param {string} estado
 * @param {{ motivo?: string }} [opciones]
 * @returns {Promise<{ cita: object|null, error: object|null }>}
 */
export async function cambiarEstadoDeCita(id, estado, { motivo } = {}) {
  if (!id) return { cita: null, error: sinPermiso("Hace falta el id de la cita.") };
  const fila = { estado };
  if (estado === ESTADOS_CITA.CANCELADA) fila.motivo_cancelacion = motivoDeCancelacion(motivo);
  return escribirCita(
    obtenerSupabase().from("citas").update(fila).eq("id", id),
    "No se pudo cambiar el estado de la cita. Revisa tus permisos.",
  );
}

/**
 * Cuantas citas de la jornada siguen creadas o en atencion: el cierre las cancela, y el resumen de
 * cierre lo avisa antes.
 *
 * @param {string} jornadaId
 * @returns {Promise<{ cantidad: number|null, error: object|null }>}
 */
export async function contarCitasPendientesDeJornada(jornadaId) {
  if (!jornadaId) return { cantidad: 0, error: null };
  try {
    const { count, error } = await obtenerSupabase()
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("jornada_id", jornadaId)
      .in("estado", [ESTADOS_CITA.CREADA, ESTADOS_CITA.EN_ATENCION]);
    if (error) return { cantidad: null, error: normalizarError(error) };
    return { cantidad: count ?? 0, error: null };
  } catch (error) {
    return { cantidad: null, error: normalizarError(error) };
  }
}

/**
 * Las jornadas donde se puede agendar: planificadas o en curso, que el usuario ve.
 *
 * @returns {Promise<{ jornadas: object[], error: object|null }>}
 */
export async function listarJornadasParaAgendar() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("jornadas")
      .select("id, nombre, fecha, estado")
      .in("estado", [ESTADOS_JORNADA.PLANIFICADA, ESTADOS_JORNADA.EN_CURSO])
      .order("fecha", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) return { jornadas: [], error: normalizarError(error) };
    return { jornadas: data ?? [], error: null };
  } catch (error) {
    return { jornadas: [], error: normalizarError(error) };
  }
}

/**
 * Los medicos del cuadro de turnos de una jornada, con su turno: los profesionales que puede tener
 * una cita (fn_validar_cita).
 *
 * @param {string} jornadaId
 * @returns {Promise<{ profesionales: object[], error: object|null }>}
 */
export async function listarProfesionalesDeJornada(jornadaId) {
  if (!jornadaId) return { profesionales: [], error: null };
  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_personal")
      .select(
        "perfilId:perfil_id, horaInicio:hora_inicio, horaFin:hora_fin, perfil:nombres_de_perfiles(nombres, apellidos, activo)",
      )
      .eq("jornada_id", jornadaId)
      .eq("rol_en_jornada", "medico");
    if (error) return { profesionales: [], error: normalizarError(error) };
    const profesionales = (data ?? [])
      .filter((fila) => fila.perfil?.activo !== false)
      .map((fila) => ({
        id: fila.perfilId,
        nombre: nombreDe(fila.perfil) ?? "Sin nombre",
        horaInicio: fila.horaInicio ? String(fila.horaInicio).slice(0, 5) : null,
        horaFin: fila.horaFin ? String(fila.horaFin).slice(0, 5) : null,
      }))
      .sort((uno, otro) => uno.nombre.localeCompare(otro.nombre, "es"));
    return { profesionales, error: null };
  } catch (error) {
    return { profesionales: [], error: normalizarError(error) };
  }
}
