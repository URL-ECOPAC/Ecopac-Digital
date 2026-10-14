// Hook de pantalla del cuadro de turnos de una jornada (issue #185): las advertencias de
// horario de cada persona ya asignada (jornada.personal, useDetalleJornada.js), montado sobre la
// misma pestaña Equipo de #181. Asignar (alta) sigue siendo el modal de #182
// (useAsignacionPersonal.js, ModalAsignarPersonal.jsx); este hook no lo reconstruye.
//
// Las dos advertencias de horario conviven: el choque de dia completo de #182
// (advertirChoqueDeHorario, sin comparar horas) y el traslape real de esta issue
// (advertirTraslapeDeHorario, que si las compara). Las dos viven en validaciones.js y las usa
// tambien useAsignacionPersonal.js (modal de alta de #182), para que la regla no se duplique en
// dos pantallas.

import { useEffect, useMemo, useState } from "react";

import { obtenerAsignacionesDelDia } from "./api.js";
import { advertirChoqueDeHorario, advertirTraslapeDeHorario } from "./validaciones.js";

/**
 * Advertencias de horario de cada persona del cuadro de turnos, indexadas por perfilId.
 *
 * Funcion pura, exportada aparte del hook para poder probarla sin montarlo (vitest corre con
 * environment "node", sin DOM, mismo motivo documentado en useAsignacionPersonal.js).
 *
 * @param {object[]} personal jornada.personal (COLUMNAS_DE_PERSONAL de api.js: trae perfilId,
 *   horaInicio, horaFin).
 * @param {Array<{ perfil, jornadaId, jornadaNombre, horaInicio, horaFin }>} asignacionesDelDia
 *   Personal de cualquier OTRA jornada en la misma fecha (obtenerAsignacionesDelDia()).
 * @param {string} jornadaActualId
 * @returns {Record<string, { choque: string|null, traslape: string|null }>}
 */
export function advertenciasDeCuadroTurnos(personal, asignacionesDelDia, jornadaActualId) {
  const advertencias = {};

  for (const fila of personal ?? []) {
    if (!fila?.perfilId) continue;

    advertencias[fila.perfilId] = {
      choque: advertirChoqueDeHorario({
        perfil: fila.perfilId,
        jornadaActualId,
        asignacionesDelDia,
      }),
      traslape: advertirTraslapeDeHorario({
        perfil: fila.perfilId,
        horaInicio: fila.horaInicio,
        horaFin: fila.horaFin,
        jornadaActualId,
        asignacionesDelDia,
      }),
    };
  }

  return advertencias;
}

/**
 * Trae el personal de cualquier otra jornada en la misma fecha y arma las advertencias de
 * horario de cada persona del cuadro de turnos.
 *
 * Un fallo de la consulta deja `asignacionesDelDia` en `[]` y `errorAdvertencias` con el motivo:
 * la pantalla tiene que poder distinguir "no hay traslapes" de "no se pudo comprobar" (mismo
 * criterio que verificarChoque() en useAsignacionPersonal.js), no tragarse el fallo en silencio.
 *
 * `asignacionesDelDia` se devuelve ademas de `advertencias`: el modal de edicion
 * (useEdicionTurno.js) lo necesita para recalcular la advertencia con los valores que se esten
 * escribiendo, no solo con el horario ya guardado.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.jornadaId]
 * @param {string} [opciones.jornadaFecha] Fecha AAAA-MM-DD de la jornada.
 * @param {object[]} [opciones.personal] jornada.personal.
 * @returns {{
 *   advertencias: Record<string, { choque: string|null, traslape: string|null }>,
 *   asignacionesDelDia: object[],
 *   cargandoAdvertencias: boolean,
 *   errorAdvertencias: object|null,
 * }}
 */
export function useCuadroTurnos({ jornadaId, jornadaFecha, personal } = {}) {
  const [asignacionesDelDia, setAsignacionesDelDia] = useState([]);
  const [cargandoAdvertencias, setCargandoAdvertencias] = useState(false);
  const [errorAdvertencias, setErrorAdvertencias] = useState(null);

  useEffect(() => {
    let vigente = true;

    if (!jornadaFecha) {
      setAsignacionesDelDia([]);
      setErrorAdvertencias(null);
      return undefined;
    }

    setCargandoAdvertencias(true);
    obtenerAsignacionesDelDia(jornadaFecha, { excluirJornada: jornadaId }).then(
      ({ asignaciones, error }) => {
        if (!vigente) return;
        setCargandoAdvertencias(false);
        setErrorAdvertencias(error);
        setAsignacionesDelDia(error ? [] : asignaciones);
      },
    );

    return () => {
      vigente = false;
    };
  }, [jornadaFecha, jornadaId]);

  const advertencias = useMemo(
    () => advertenciasDeCuadroTurnos(personal, asignacionesDelDia, jornadaId),
    [personal, asignacionesDelDia, jornadaId],
  );

  return { advertencias, asignacionesDelDia, cargandoAdvertencias, errorAdvertencias };
}
