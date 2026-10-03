// El calendario de la agenda (issue #927): la cuadricula del mes y los horarios del dia, como datos.
// Las apps solo los dibujan. Funciones puras: se prueban sin montar nada.
//
// La semana empieza el lunes, como se lee un calendario en Guatemala.

import { aFechaLocal, MESES } from "../formato/fechas.js";
import { citaOcupaSala } from "./estados.js";
import {
  aInstanteDeGuatemala,
  fechaEnGuatemala,
  horaEnGuatemala,
  minutosDelDia,
  sumarDias,
} from "./horas.js";
import { salasLibres } from "./validaciones.js";

export const VISTAS_AGENDA = Object.freeze({ MES: "mes", DIA: "dia" });

/** Los dias de la semana en la cabecera del mes, de lunes a domingo. */
export const DIAS_DE_LA_SEMANA_AGENDA = Object.freeze([
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
  "Dom",
]);

/** El dia de la jornada, en horarios de 30 minutos: de 07:00 a 18:00, ampliable por las citas. */
export const HORA_DE_INICIO_DEL_DIA = "07:00";
export const HORA_DE_FIN_DEL_DIA = "18:00";
export const MINUTOS_POR_HORARIO = 30;

function conDosDigitos(numero) {
  return String(numero).padStart(2, "0");
}

function aHora(minutos) {
  return `${conDosDigitos(Math.floor(minutos / 60))}:${conDosDigitos(minutos % 60)}`;
}

/** Dia de la semana de una fecha, 0 = lunes. */
function diaDeLaSemana(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return (aFechaLocal(Date.UTC(anio, mes - 1, dia)).getUTCDay() + 6) % 7;
}

/**
 * "Octubre de 2026" o "Sábado 3 de octubre de 2026", segun la vista.
 *
 * @param {string} vista
 * @param {string} fecha "AAAA-MM-DD"
 * @returns {string}
 */
export function tituloDeLaAgenda(vista, fecha) {
  const [anio, mes, dia] = String(fecha ?? "")
    .split("-")
    .map(Number);
  if (!anio) return "";
  const nombreDelMes = MESES[mes - 1];
  if (vista === VISTAS_AGENDA.MES) {
    return `${nombreDelMes.charAt(0).toUpperCase()}${nombreDelMes.slice(1)} de ${anio}`;
  }
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  return `${dias[diaDeLaSemana(fecha)]} ${dia} de ${nombreDelMes} de ${anio}`;
}

/**
 * El rango de fechas que cubre la vista: el dia, o las semanas completas del mes.
 *
 * @param {string} vista
 * @param {string} fecha
 * @returns {{ primerDia: string, ultimoDia: string, desde: string, hasta: string }}
 */
export function rangoDeLaVista(vista, fecha) {
  if (vista === VISTAS_AGENDA.DIA) {
    return {
      primerDia: fecha,
      ultimoDia: fecha,
      desde: aInstanteDeGuatemala(fecha, "00:00"),
      hasta: aInstanteDeGuatemala(sumarDias(fecha, 1), "00:00"),
    };
  }
  const [anio, mes] = fecha.split("-").map(Number);
  const primeroDelMes = `${anio}-${conDosDigitos(mes)}-01`;
  const ultimoDelMes = sumarDias(
    `${mes === 12 ? anio + 1 : anio}-${conDosDigitos(mes === 12 ? 1 : mes + 1)}-01`,
    -1,
  );
  const primerDia = sumarDias(primeroDelMes, -diaDeLaSemana(primeroDelMes));
  const ultimoDia = sumarDias(ultimoDelMes, 6 - diaDeLaSemana(ultimoDelMes));
  return {
    primerDia,
    ultimoDia,
    desde: aInstanteDeGuatemala(primerDia, "00:00"),
    hasta: aInstanteDeGuatemala(sumarDias(ultimoDia, 1), "00:00"),
  };
}

/**
 * La fecha a la que se mueve la agenda con Anterior o Siguiente.
 *
 * @param {string} vista
 * @param {string} fecha
 * @param {-1|1} sentido
 * @returns {string}
 */
export function moverFecha(vista, fecha, sentido) {
  if (vista === VISTAS_AGENDA.DIA) return sumarDias(fecha, sentido);
  const [anio, mes] = fecha.split("-").map(Number);
  const indice = anio * 12 + (mes - 1) + sentido;
  return `${Math.floor(indice / 12)}-${conDosDigitos((indice % 12) + 1)}-01`;
}

/** Las citas agrupadas por su dia en Guatemala, ordenadas por hora. */
function citasPorDia(citas) {
  const porDia = new Map();
  [...citas]
    .sort((una, otra) => String(una.iniciaEn).localeCompare(String(otra.iniciaEn)))
    .forEach((cita) => {
      const dia = fechaEnGuatemala(cita.iniciaEn);
      porDia.set(dia, [...(porDia.get(dia) ?? []), cita]);
    });
  return porDia;
}

/**
 * La cuadricula del mes: semanas de lunes a domingo, cada dia con sus citas.
 *
 * @param {string} fecha Cualquier dia del mes.
 * @param {object[]} citas Las citas ya filtradas.
 * @param {string} hoy "AAAA-MM-DD"
 * @returns {{ fecha: string, dia: number, delMes: boolean, esHoy: boolean, citas: object[] }[][]}
 */
export function semanasDelMes(fecha, citas = [], hoy = "") {
  const { primerDia, ultimoDia } = rangoDeLaVista(VISTAS_AGENDA.MES, fecha);
  const mes = fecha.slice(0, 7);
  const porDia = citasPorDia(citas);
  const semanas = [];
  for (let dia = primerDia; dia <= ultimoDia; dia = sumarDias(dia, 1)) {
    if (diaDeLaSemana(dia) === 0) semanas.push([]);
    semanas[semanas.length - 1].push({
      fecha: dia,
      dia: Number(dia.slice(8, 10)),
      delMes: dia.slice(0, 7) === mes,
      esHoy: dia === hoy,
      citas: porDia.get(dia) ?? [],
    });
  }
  return semanas;
}

/**
 * Los horarios del dia, cada uno con las citas que empiezan en el y, si hay una clinica elegida,
 * cuantas salas le quedan libres.
 *
 * @param {string} fecha
 * @param {object[]} citas Las citas ya filtradas, para dibujar.
 * @param {{ salas?: number|null, citasDeLaClinica?: object[] }} [clinica] La clinica filtrada:
 *   todas sus citas del dia, sin los demas filtros, para contar bien las salas.
 * @returns {{ hora: string, citas: object[], salasLibres: number|null }[]}
 */
export function horariosDelDia(fecha, citas = [], { salas = null, citasDeLaClinica = [] } = {}) {
  const delDia = (citasPorDia(citas).get(fecha) ?? [])
    .map((cita) => ({ cita, minutos: minutosDelDia(horaEnGuatemala(cita.iniciaEn)) }))
    .filter(({ minutos }) => minutos !== null);
  const primero = Math.min(
    minutosDelDia(HORA_DE_INICIO_DEL_DIA),
    ...delDia.map(({ minutos }) => Math.floor(minutos / MINUTOS_POR_HORARIO) * MINUTOS_POR_HORARIO),
  );
  const ultimo = Math.max(
    minutosDelDia(HORA_DE_FIN_DEL_DIA),
    ...delDia.map(({ minutos }) => minutos + MINUTOS_POR_HORARIO),
  );

  const horarios = [];
  for (let minutos = primero; minutos < ultimo; minutos += MINUTOS_POR_HORARIO) {
    const hora = aHora(minutos);
    const intervalo = {
      iniciaEn: aInstanteDeGuatemala(fecha, hora),
      terminaEn: aInstanteDeGuatemala(fecha, aHora(minutos + MINUTOS_POR_HORARIO)),
    };
    horarios.push({
      hora,
      citas: delDia
        .filter((item) => item.minutos >= minutos && item.minutos < minutos + MINUTOS_POR_HORARIO)
        .map((item) => item.cita),
      salasLibres:
        salas == null
          ? null
          : salasLibres(salas, citasDeLaClinica.filter(citaOcupaSala), intervalo),
    });
  }
  return horarios;
}
