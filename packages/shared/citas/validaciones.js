// Validaciones de la agenda de citas (issue #927).
//
// Dos clases de regla:
//
// 1. Las del formulario (validarCita): campos requeridos, la hora de fin despues del inicio, la
//    fecha no antes de la jornada. Se muestran junto a cada campo.
// 2. El espejo de lo que fn_validar_cita (00184) hace cumplir: el cupo de la clinica y que ni el
//    paciente ni el profesional tengan dos citas a la vez. La base es la garantia -tambien frente a
//    dos personas agendando al mismo tiempo-, pero sus mensajes no llegan a la pantalla
//    (normalizarError los vuelve genericos), asi que el cliente avisa antes de guardar.
//
// Ademas, un aviso que no bloquea: la cita fuera del turno del profesional en el cuadro de turnos.

import { esTextoVacio, normalizarTexto } from "../validations/index.js";
import { citaOcupaSala } from "./estados.js";
import { aInstanteDeGuatemala, minutosDelDia, msDe } from "./horas.js";

export const LARGO_MAXIMO_NOTAS_DE_CITA = 1000;
export const LARGO_MAXIMO_MOTIVO_DE_CANCELACION = 500;

/**
 * Los errores del formulario de cita.
 *
 * @param {{ pacienteId?: string, jornadaId?: string, clinicaId?: string, areaId?: string,
 *   fecha?: string, horaInicio?: string, horaFin?: string, notas?: string }} datos
 * @param {{ fechaDeJornada?: string|null }} [contexto]
 * @returns {Record<string, string>}
 */
export function validarCita(datos = {}, { fechaDeJornada = null } = {}) {
  const errores = {};

  if (!datos.pacienteId) errores.pacienteId = "Elige al paciente.";
  if (!datos.jornadaId) errores.jornadaId = "Elige la jornada.";
  if (!datos.clinicaId) errores.clinicaId = "Elige la clínica.";
  if (!datos.areaId) errores.areaId = "Elige el área de atención.";

  if (!datos.fecha) {
    errores.fecha = "Indica la fecha.";
  } else if (fechaDeJornada && datos.fecha < fechaDeJornada) {
    const [anio, mes, dia] = fechaDeJornada.split("-");
    errores.fecha = `La cita no puede ser antes de la fecha de la jornada (${dia}/${mes}/${anio}).`;
  }

  const inicio = minutosDelDia(datos.horaInicio);
  const fin = minutosDelDia(datos.horaFin);
  if (inicio === null) errores.horaInicio = "Indica la hora de inicio.";
  if (fin === null) {
    errores.horaFin = "Indica la hora de fin.";
  } else if (inicio !== null && fin <= inicio) {
    errores.horaFin = "La hora de fin tiene que ser después del inicio.";
  }

  if (normalizarTexto(datos.notas ?? "").length > LARGO_MAXIMO_NOTAS_DE_CITA) {
    errores.notas = `Las notas no pueden pasar de ${LARGO_MAXIMO_NOTAS_DE_CITA} caracteres.`;
  }

  return errores;
}

/**
 * El motivo de una cancelacion es opcional, pero tiene un largo.
 *
 * @param {string} [motivo]
 * @returns {Record<string, string>}
 */
export function validarCancelacion(motivo = "") {
  if (normalizarTexto(motivo ?? "").length > LARGO_MAXIMO_MOTIVO_DE_CANCELACION) {
    return {
      motivo: `El motivo no puede pasar de ${LARGO_MAXIMO_MOTIVO_DE_CANCELACION} caracteres.`,
    };
  }
  return {};
}

/**
 * El motivo tal como se guarda: sin espacios de mas, o null si quedo vacio.
 *
 * @param {string|null} motivo
 * @returns {string|null}
 */
export function motivoDeCancelacion(motivo) {
  const limpio = normalizarTexto(motivo ?? "");
  return esTextoVacio(limpio) ? null : limpio;
}

/**
 * El intervalo de la cita del formulario, como instantes.
 *
 * @param {{ fecha?: string, horaInicio?: string, horaFin?: string }} datos
 * @returns {{ iniciaEn: string, terminaEn: string }|null}
 */
export function intervaloDeCita(datos = {}) {
  const iniciaEn = aInstanteDeGuatemala(datos.fecha, datos.horaInicio);
  const terminaEn = aInstanteDeGuatemala(datos.fecha, datos.horaFin);
  if (!iniciaEn || !terminaEn || msDe(terminaEn) <= msDe(iniciaEn)) return null;
  return { iniciaEn, terminaEn };
}

/**
 * Dos intervalos se traslapan si uno empieza antes de que termine el otro, y al reves. Tocarse en
 * el borde (una termina 10:30 y la otra empieza 10:30) no es traslape: la misma regla que la base.
 *
 * @param {{ iniciaEn: string, terminaEn: string }} a
 * @param {{ iniciaEn: string, terminaEn: string }} b
 * @returns {boolean}
 */
export function seTraslapan(a, b) {
  return msDe(a.iniciaEn) < msDe(b.terminaEn) && msDe(a.terminaEn) > msDe(b.iniciaEn);
}

/**
 * Cuantas citas que ocupan sala coinciden a la vez, como maximo, dentro del intervalo. Espejo de
 * fn_maximo_de_citas_simultaneas: el maximo se alcanza en un inicio, el del intervalo o el de una
 * cita que empieza dentro de el.
 *
 * @param {object[]} citas Citas de la clinica.
 * @param {{ iniciaEn: string, terminaEn: string }} intervalo
 * @param {string|null} [excluirId] La cita que se esta editando.
 * @returns {number}
 */
export function maximoDeCitasSimultaneas(citas = [], intervalo, excluirId = null) {
  const desde = msDe(intervalo.iniciaEn);
  const hasta = msDe(intervalo.terminaEn);
  const vigentes = citas.filter((cita) => citaOcupaSala(cita) && cita.id !== excluirId);
  const puntos = [
    desde,
    ...vigentes.map((cita) => msDe(cita.iniciaEn)).filter((ms) => ms > desde && ms < hasta),
  ];
  return Math.max(
    0,
    ...puntos.map(
      (punto) =>
        vigentes.filter((cita) => msDe(cita.iniciaEn) <= punto && msDe(cita.terminaEn) > punto)
          .length,
    ),
  );
}

/**
 * Salas que quedan libres en una clinica durante un intervalo.
 *
 * @param {number} salas salas_disponibles de la clinica.
 * @param {object[]} citas Citas de la clinica.
 * @param {{ iniciaEn: string, terminaEn: string }} intervalo
 * @returns {number}
 */
export function salasLibres(salas, citas, intervalo) {
  return Math.max(0, Number(salas || 0) - maximoDeCitasSimultaneas(citas, intervalo));
}

/**
 * Lo que impediria guardar la cita, con las citas que el cliente alcanza a ver.
 *
 * @param {{ id?: string, pacienteId: string, clinicaId: string, profesionalId?: string|null }} cita
 * @param {{ iniciaEn: string, terminaEn: string }} intervalo
 * @param {{ delPaciente?: object[], delProfesional?: object[], deLaClinica?: object[],
 *   salas?: number|null }} contexto
 * @returns {Record<string, string>} Por campo: pacienteId, profesionalId, clinicaId.
 */
export function conflictosDeCita(cita, intervalo, contexto = {}) {
  const conflictos = {};
  const otras = (lista) =>
    (lista ?? []).filter((otra) => otra.id !== cita.id && citaOcupaSala(otra));

  if (otras(contexto.delPaciente).some((otra) => seTraslapan(otra, intervalo))) {
    conflictos.pacienteId = "El paciente ya tiene otra cita a esa hora.";
  }

  if (
    cita.profesionalId &&
    otras(contexto.delProfesional).some((otra) => seTraslapan(otra, intervalo))
  ) {
    conflictos.profesionalId = "El profesional ya tiene otra cita a esa hora.";
  }

  if (contexto.salas != null) {
    const ocupadas = maximoDeCitasSimultaneas(contexto.deLaClinica ?? [], intervalo, cita.id);
    if (ocupadas + 1 > contexto.salas) {
      conflictos.clinicaId = `La clínica ya tiene sus ${contexto.salas} ${
        contexto.salas === 1 ? "sala ocupada" : "salas ocupadas"
      } a esa hora.`;
    }
  }

  return conflictos;
}

/**
 * Aviso -no bloquea- si la cita cae fuera del turno del profesional en el cuadro de turnos.
 *
 * @param {{ horaInicio?: string, horaFin?: string }} datos
 * @param {{ horaInicio?: string|null, horaFin?: string|null }|null} turno
 * @returns {string|null}
 */
export function avisoDeFueraDeTurno(datos, turno) {
  if (!turno) return null;
  const inicio = minutosDelDia(datos.horaInicio);
  const fin = minutosDelDia(datos.horaFin);
  const turnoInicio = minutosDelDia(turno.horaInicio);
  const turnoFin = minutosDelDia(turno.horaFin);
  if (inicio === null || fin === null || turnoInicio === null || turnoFin === null) return null;
  if (inicio >= turnoInicio && fin <= turnoFin) return null;
  return `La cita queda fuera del turno del profesional (${turno.horaInicio} - ${turno.horaFin}).`;
}
