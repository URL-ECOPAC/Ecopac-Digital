// Reglas de negocio de las jornadas y del personal asignado.
//
// Se aplican en el cliente antes de llamar al servidor, y web y movil las comparten para que
// digan exactamente lo mismo. La politica real la sigue aplicando la base de datos: los NOT
// NULL y el CHECK de fecha de la migracion 00012, y el UNIQUE (jornada_id, perfil_id) que
// impide asignar dos veces a la misma persona en la misma jornada. Que esto pase no significa
// que el servidor vaya a aceptarlo.
//
// Las claves del objeto de errores son los ids de CAMPOS_JORNADA y CAMPOS_ASIGNACION_PERSONAL,
// para que un formulario pueda pintar cada mensaje debajo de su campo sin traducir nada. Es la
// misma forma que devuelven packages/shared/usuarios/validaciones.js y
// packages/shared/donaciones/proyectos.validaciones.js.

import { aFechaLocal } from "../formato/fechas.js";
import { combinarErrores, esTextoVacio, validarConDescriptores } from "../validations/index.js";
import { CAMPOS_ASIGNACION_PERSONAL, CAMPOS_JORNADA } from "./campos.js";

/** Cadena de hora HH:MM; los minutos van obligados, las horas de uno o dos digitos. */
const FORMA_DE_HORA = /^(\d{1,2}):(\d{2})$/;

/**
 * Valida los datos de una jornada.
 *
 * Lo que el descriptor puede expresar -obligatorio, longitud maxima- se aplica desde
 * CAMPOS_JORNADA; encima se suma la regla que un descriptor aun no declara para el motor: la
 * fecha no puede ser anterior a hoy. La columna fecha de la migracion 00012 ademas tiene un
 * CHECK contra created_at, pero aqui se valida contra el dia actual, que es lo que una persona
 * entiende por "fecha pasada".
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_JORNADA.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarJornada(valores) {
  const porDescriptor = validarConDescriptores(CAMPOS_JORNADA, valores);
  return combinarErrores(porDescriptor, validarFechaJornada(valores));
}

/**
 * Valida una fila de asignacion de personal a una jornada.
 *
 * Aplica los obligatorios de CAMPOS_ASIGNACION_PERSONAL y la coherencia de horario: la hora de
 * fin tiene que ser posterior a la de inicio, espejo del CHECK chk_jornada_personal_horario de
 * la migracion 00012.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_ASIGNACION_PERSONAL.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarAsignacionPersonal(valores) {
  const porDescriptor = validarConDescriptores(CAMPOS_ASIGNACION_PERSONAL, valores);
  return combinarErrores(porDescriptor, validarHorario(valores));
}

/**
 * Valida el conjunto de asignaciones de una jornada.
 *
 * La regla de campo no alcanza para esto: el mismo perfil puede aparecer una sola vez en la
 * lista. Es espejo del UNIQUE (jornada_id, perfil_id) de la migracion 00012. Se agrupa bajo la
 * clave "perfil" porque es el campo que el usuario tendria que corregir.
 *
 * @param {Array<{ perfil: string }>} asignaciones Filas del formulario de personal.
 * @returns {Record<string, string>} Errores. Vacio si nadie esta repetido.
 */
export function validarAsignaciones(asignaciones) {
  const vistos = new Set();

  for (const asignacion of asignaciones ?? []) {
    const perfil = asignacion?.perfil;
    if (esTextoVacio(perfil)) continue;

    if (vistos.has(perfil)) {
      return {
        perfil: "No puedes asignar a la misma persona dos veces a la misma jornada.",
      };
    }
    vistos.add(perfil);
  }

  return {};
}

/**
 * Advierte si la persona ya esta asignada a otra jornada el mismo dia.
 *
 * No es un error: la base de datos si permite que una persona este en dos jornadas distintas el
 * mismo dia. Es una advertencia para que quien asigna se fije antes de guardar. Devuelve null
 * cuando no hay choque, para que la pantalla decida si muestra algo.
 *
 * @param {object} args
 * @param {string} args.perfil Id del perfil que se esta asignando.
 * @param {string} args.jornadaActualId Id de la jornada que se edita (sus propias asignaciones
 *   no cuentan como choque).
 * @param {Array<{ jornadaId: string, jornadaNombre: string, perfil: string }>} args.asignacionesDelDia
 *   Asignaciones de todas las jornadas que caen en la misma fecha.
 * @returns {string|null} Texto de la advertencia, o null si no hay choque.
 */
export function advertirChoqueDeHorario({ perfil, jornadaActualId, asignacionesDelDia } = {}) {
  if (esTextoVacio(perfil)) return null;

  const choque = (asignacionesDelDia ?? []).find(
    (asignacion) => asignacion?.perfil === perfil && asignacion?.jornadaId !== jornadaActualId,
  );

  if (!choque) return null;

  const nombre = choque.jornadaNombre?.trim();
  return nombre
    ? `Esta persona ya esta asignada a otra jornada el mismo dia: ${nombre}.`
    : "Esta persona ya esta asignada a otra jornada el mismo dia.";
}

/** Reglas de la fecha de una jornada, mas alla de lo que expresa el descriptor. */
function validarFechaJornada(valores) {
  const fecha = valores?.fecha;
  if (esTextoVacio(fecha)) return {};

  const comoFecha = aFechaLocal(fecha);
  if (!comoFecha) {
    return { fecha: "La fecha no es una fecha valida." };
  }

  if (aDiaDeCalendario(comoFecha) < aDiaDeCalendario(new Date())) {
    return { fecha: "La fecha no puede ser anterior a hoy." };
  }

  return {};
}

/** Reglas del horario de una asignacion: horaFin posterior a horaInicio. */
function validarHorario(valores) {
  const inicio = valores?.horaInicio;
  const fin = valores?.horaFin;

  if (esTextoVacio(inicio) || esTextoVacio(fin)) return {};

  const minutosInicio = aMinutos(inicio);
  const minutosFin = aMinutos(fin);

  if (minutosInicio === null || minutosFin === null) {
    return { horaFin: "Escribe la hora en formato HH:MM." };
  }

  if (minutosFin <= minutosInicio) {
    return { horaFin: "La hora de fin debe ser posterior a la de inicio." };
  }

  return {};
}

/** Dia de calendario de una fecha, como milisegundos de su medianoche local. */
function aDiaDeCalendario(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

/** Minutos desde la medianoche de una cadena HH:MM, o null si no es una hora valida. */
function aMinutos(hora) {
  if (typeof hora !== "string") return null;

  const partes = FORMA_DE_HORA.exec(hora.trim());
  if (!partes) return null;

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) return null;

  return horas * 60 + minutos;
}
