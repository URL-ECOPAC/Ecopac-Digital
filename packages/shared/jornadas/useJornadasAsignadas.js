// View model del listado movil de jornadas asignadas (issue #188).
//
// No usa el contexto de jornada activa (useJornadaActiva()/JornadaActivaProvider): esta pantalla
// necesita TODAS las jornadas asignadas a la persona (pasadas y futuras), no solo las que estan
// en curso ahora. Llama obtenerJornadasDePersona() por su cuenta, igual que useJornadaActiva()
// ya hace internamente para resolver sus propias candidatas.

import { useCallback, useEffect, useState } from "react";

import { aFechaLocal } from "../formato/fechas.js";
import { ESTADOS_JORNADA } from "../enums.js";
import { obtenerJornadasDePersona } from "./api.js";

/**
 * Dia de calendario de una fecha, como milisegundos UTC de su medianoche. Comparar por dia y no
 * por milisegundos reales evita que la hora del momento en que se abre la pantalla (`hoy` trae
 * hora ademas de fecha) empuje la jornada de HOY al grupo de pasadas.
 */
function aDiaDeCalendario(fecha) {
  return Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Separa jornadas asignadas en proximas y pasadas (issue #188, criterio 1).
 *
 * Primero el estado, despues la fecha -- no al reves. Corrige un bug de la primera version de
 * este archivo (`EN_CURSO o fecha >= hoy`), que metia en "proximas" una jornada FINALIZADA con
 * fecha de hoy (ya cerro, no hay nada por venir) y una CANCELADA con fecha futura (nunca va a
 * ocurrir): alguien que lee "proxima jornada: Vista Hermosa" cuando esa jornada esta cancelada se
 * presenta a una comunidad donde no hay nadie.
 *
 * - EN_CURSO siempre es proxima, sin importar su fecha: es lo que se esta trabajando ahora.
 * - FINALIZADA y CANCELADA siempre son pasadas, sin importar su fecha: ninguna de las dos tiene
 *   algo por venir. Las canceladas SI aparecen (no se ocultan, mismo criterio que las cuatro
 *   etapas de la cola en #187): la pantalla las distingue con StatusChip
 *   (JornadasAsignadasScreen.js) para que no se confundan con una jornada que si se realizo.
 * - PLANIFICADA se separa por fecha: hoy o en adelante es proxima (todavia no llega su dia);
 *   antes de hoy es pasada (quedo vencida sin que alguien actualizara su estado -- dato raro
 *   pero real, y mostrarla como "proxima" seria la misma mentira que el bug que esto corrige).
 *
 * Usa aFechaLocal() (formato/fechas.js) para el parseo, no uno propio.
 *
 * @param {object[]} jornadas Con la forma que devuelve obtenerJornadasDePersona().
 * @param {Date} [hoy]
 * @returns {{ proximas: object[], pasadas: object[] }}
 */
export function separarProximasYPasadas(jornadas = [], hoy = new Date()) {
  const hoyLocal = aFechaLocal(hoy);
  const diaDeHoy = hoyLocal === null ? null : aDiaDeCalendario(hoyLocal);
  const proximas = [];
  const pasadas = [];

  for (const jornada of jornadas) {
    if (
      jornada.estado === ESTADOS_JORNADA.FINALIZADA ||
      jornada.estado === ESTADOS_JORNADA.CANCELADA
    ) {
      pasadas.push(jornada);
      continue;
    }

    if (jornada.estado === ESTADOS_JORNADA.EN_CURSO) {
      proximas.push(jornada);
      continue;
    }

    const fechaJornada = aFechaLocal(jornada.fecha);
    const esPasada =
      fechaJornada !== null && diaDeHoy !== null && aDiaDeCalendario(fechaJornada) < diaDeHoy;

    (esPasada ? pasadas : proximas).push(jornada);
  }

  return { proximas, pasadas };
}

/**
 * Jornadas asignadas a la persona, separadas en proximas y pasadas.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.perfilId]
 * @returns {{
 *   proximas: object[],
 *   pasadas: object[],
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 * }}
 */
export function useJornadasAsignadas({ perfilId } = {}) {
  const [jornadas, setJornadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const respuesta = await obtenerJornadasDePersona(perfilId);
    setJornadas(respuesta.jornadas);
    setError(respuesta.error);
    setCargando(false);
  }, [perfilId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { proximas, pasadas } = separarProximasYPasadas(jornadas);

  return { proximas, pasadas, cargando, error, recargar: cargar };
}
