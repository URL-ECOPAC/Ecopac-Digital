// La hora de una cita en Guatemala (issue #927).
//
// inicia_en y termina_en son timestamptz y la issue pide mostrarlos en America/Guatemala, con el
// mismo cuidado que la 00165 tuvo con la fecha de gasto. formato/fechas.js formatea en la hora del
// dispositivo, que suele ser la misma pero no siempre (un telefono configurado en otra zona, el
// navegador de quien revisa desde fuera): aqui la zona es fija.
//
// Sin Intl, por la misma razon que formato/fechas.js: en Hermes no esta garantizado. Guatemala no
// tiene horario de verano desde 2006, asi que la zona es un desplazamiento fijo de -6 horas.

import { aFechaLocal } from "../formato/fechas.js";

const DESPLAZAMIENTO_MS = -6 * 60 * 60 * 1000;
const DESPLAZAMIENTO_ISO = "-06:00";

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const SOLO_HORA = /^(\d{2}):(\d{2})(?::\d{2})?$/;

/** Duracion por defecto de una cita: la de la base (fn_validar_cita, 00184). */
export const DURACION_DE_CITA_MIN = 30;

function conDosDigitos(numero) {
  return String(numero).padStart(2, "0");
}

/**
 * El instante de una fecha y una hora de Guatemala, como cadena ISO con su desplazamiento.
 *
 * @param {string} fecha "AAAA-MM-DD"
 * @param {string} hora "HH:MM"
 * @returns {string|null} "2026-10-03T10:30:00-06:00", o null si falta algo o no es valido.
 */
export function aInstanteDeGuatemala(fecha, hora) {
  if (!SOLO_FECHA.test(String(fecha ?? "")) || !SOLO_HORA.test(String(hora ?? ""))) return null;
  const [, hh, mm] = SOLO_HORA.exec(hora);
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  return `${fecha}T${hh}:${mm}:00${DESPLAZAMIENTO_ISO}`;
}

/**
 * La fecha y la hora en Guatemala de un instante.
 *
 * @param {string|Date|null} instante
 * @returns {{ fecha: string, hora: string }|null}
 */
export function partesEnGuatemala(instante) {
  if (!instante) return null;
  const ms = msDe(instante);
  if (Number.isNaN(ms)) return null;
  const local = aFechaLocal(ms + DESPLAZAMIENTO_MS);
  return {
    fecha: `${local.getUTCFullYear()}-${conDosDigitos(local.getUTCMonth() + 1)}-${conDosDigitos(local.getUTCDate())}`,
    hora: `${conDosDigitos(local.getUTCHours())}:${conDosDigitos(local.getUTCMinutes())}`,
  };
}

/**
 * La hora en Guatemala de un instante.
 *
 * @param {string|Date|null} instante
 * @returns {string} "10:30", o cadena vacia.
 */
export function horaEnGuatemala(instante) {
  return partesEnGuatemala(instante)?.hora ?? "";
}

/**
 * La fecha en Guatemala de un instante.
 *
 * @param {string|Date|null} instante
 * @returns {string} "AAAA-MM-DD", o cadena vacia.
 */
export function fechaEnGuatemala(instante) {
  return partesEnGuatemala(instante)?.fecha ?? "";
}

/**
 * Fecha y hora de una cita en Guatemala.
 *
 * @param {string|Date|null} instante
 * @returns {string} "03/10/2026 10:30", o cadena vacia.
 */
export function formatearFechaHoraDeCita(instante) {
  const partes = partesEnGuatemala(instante);
  if (!partes) return "";
  const [anio, mes, dia] = partes.fecha.split("-");
  return `${dia}/${mes}/${anio} ${partes.hora}`;
}

/**
 * El horario de una cita en Guatemala.
 *
 * @param {{ iniciaEn?: string, terminaEn?: string }|null} cita
 * @returns {string} "10:30 - 11:00".
 */
export function formatearHorarioDeCita(cita) {
  const inicio = horaEnGuatemala(cita?.iniciaEn);
  const fin = horaEnGuatemala(cita?.terminaEn);
  return [inicio, fin].filter(Boolean).join(" - ");
}

/**
 * Suma minutos a una hora "HH:MM" del mismo dia. No pasa de 23:59.
 *
 * @param {string} hora
 * @param {number} minutos
 * @returns {string}
 */
export function sumarMinutos(hora, minutos) {
  const partes = SOLO_HORA.exec(String(hora ?? ""));
  if (!partes) return "";
  const total = Math.min(Number(partes[1]) * 60 + Number(partes[2]) + minutos, 23 * 60 + 59);
  return `${conDosDigitos(Math.floor(total / 60))}:${conDosDigitos(total % 60)}`;
}

/**
 * "HH:MM" a minutos desde la medianoche.
 *
 * @param {string|null} hora
 * @returns {number|null}
 */
export function minutosDelDia(hora) {
  const partes = SOLO_HORA.exec(String(hora ?? ""));
  if (!partes) return null;
  return Number(partes[1]) * 60 + Number(partes[2]);
}

/**
 * Hoy en Guatemala.
 *
 * @param {Date} [ahora] Entra por parametro para probarlo sin depender del reloj.
 * @returns {string} "AAAA-MM-DD".
 */
export function hoyEnGuatemala(ahora = new Date()) {
  return fechaEnGuatemala(ahora);
}

/**
 * Suma dias a una fecha "AAAA-MM-DD" (por calendario, sin zona).
 *
 * @param {string} fecha
 * @param {number} dias
 * @returns {string}
 */
export function sumarDias(fecha, dias) {
  const partes = SOLO_FECHA.exec(String(fecha ?? ""));
  if (!partes) return "";
  const dia = aFechaLocal(
    Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]) + dias),
  );
  return `${dia.getUTCFullYear()}-${conDosDigitos(dia.getUTCMonth() + 1)}-${conDosDigitos(dia.getUTCDate())}`;
}

/**
 * El rango de instantes que cubre un dia de Guatemala, para consultar la base.
 *
 * @param {string} fecha "AAAA-MM-DD"
 * @returns {{ desde: string, hasta: string }|null} `hasta` es la medianoche del dia siguiente.
 */
export function rangoDelDia(fecha) {
  const desde = aInstanteDeGuatemala(fecha, "00:00");
  const siguiente = aInstanteDeGuatemala(sumarDias(fecha, 1), "00:00");
  return desde && siguiente ? { desde, hasta: siguiente } : null;
}

/**
 * Milisegundos de un instante.
 *
 * @param {string|Date|null} instante
 * @returns {number} NaN si no es un instante.
 */
export function msDe(instante) {
  return aFechaLocal(instante)?.getTime() ?? Number.NaN;
}
