// Hook de pantalla de la edicion de horario y responsabilidad de una persona ya asignada a una
// jornada (issue #185, criterio 2), ampliado con asistio en la issue #756. Asignar (alta) sigue
// siendo el modal de #182 (useAsignacionPersonal.js, ModalAsignarPersonal.jsx): esto edita
// horaInicio, horaFin, responsabilidad y asistio de una fila que YA existe en jornada.personal,
// nunca el perfil ni el rol en la jornada (rolEnJornada), que el criterio de aceptacion de #185
// no menciona.
//
// Mismo patron que useEdicionUsuario.js (#107): precarga `valores` desde la fila que recibe, no
// arranca vacio. Quien lo use monta un componente nuevo por cada fila que se edite (key={fila.id}
// en quien lo renderiza), porque los valores iniciales solo se leen una vez.
//
// advertenciaChoque/advertenciaTraslape no viven en estado aparte: se recalculan en cada render a
// partir de `valores` y de `asignacionesDelDia` (useCuadroTurnos.js), igual que el modal de alta
// de #182 recalcula su propia advertencia mientras se escribe el horario.

import { useCallback, useState } from "react";

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { actualizarAsignacionPersonal } from "./api.js";
import { CAMPOS_EDICION_TURNO } from "./campos.js";
import {
  advertirChoqueDeHorario,
  advertirTraslapeDeHorario,
  validarEdicionTurno,
} from "./validaciones.js";

/**
 * `''` es el vacio correcto para un campo de texto/hora, pero enviarlo tal cual para `asistio`
 * (BOOLEANO) mandaria una cadena vacia a una columna boolean y el UPDATE fallaria en el servidor
 * -- ni siquiera hace falta tocar ese campo para que viaje: guardar() manda `valores` completo.
 * El vacio de un booleano sin marcar es `false`, no `''` (issue #756).
 */
function valoresDesdeFila(fila) {
  return CAMPOS_EDICION_TURNO.reduce((valores, campo) => {
    const vacio = campo.tipo === TIPOS_DE_CAMPO.BOOLEANO ? false : "";
    valores[campo.id] = fila?.[campo.id] ?? vacio;
    return valores;
  }, {});
}

/**
 * @param {object} [opciones]
 * @param {string} [opciones.jornadaId]
 * @param {object} [opciones.fila] Fila de jornada.personal a editar (trae perfilId, horaInicio,
 *   horaFin, responsabilidad).
 * @param {object[]} [opciones.asignacionesDelDia] Personal de cualquier otra jornada en la misma
 *   fecha (useCuadroTurnos()), para recalcular las advertencias con los valores que se esten
 *   escribiendo.
 * @returns {{
 *   valores: object,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   enviando: boolean,
 *   setCampo: (id: string, valor: unknown) => void,
 *   guardar: () => Promise<{ ok: boolean, asignacion?: object|null }>,
 *   advertenciaChoque: string|null,
 *   advertenciaTraslape: string|null,
 * }}
 */
export function useEdicionTurno({ jornadaId, fila, asignacionesDelDia } = {}) {
  const [valores, setValores] = useState(() => valoresDesdeFila(fila));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    // Se limpia el error de ESE campo al tocarlo, no todos, mismo criterio que useEdicionUsuario.js.
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const guardar = useCallback(async () => {
    if (!fila?.perfilId) return { ok: false };

    const erroresDeValidacion = validarEdicionTurno(valores);
    if (Object.keys(erroresDeValidacion).length > 0) {
      setErrores(erroresDeValidacion);
      return { ok: false };
    }

    setEnviando(true);
    setError(null);
    const { asignacion, error: errorDeGuardado } = await actualizarAsignacionPersonal(
      jornadaId,
      fila.perfilId,
      valores,
    );
    setEnviando(false);

    if (errorDeGuardado || !asignacion) {
      setError(errorDeGuardado);
      return { ok: false };
    }

    return { ok: true, asignacion };
  }, [jornadaId, fila, valores]);

  const advertenciaChoque = advertirChoqueDeHorario({
    perfil: fila?.perfilId,
    jornadaActualId: jornadaId,
    asignacionesDelDia,
  });

  const advertenciaTraslape = advertirTraslapeDeHorario({
    perfil: fila?.perfilId,
    horaInicio: valores.horaInicio,
    horaFin: valores.horaFin,
    jornadaActualId: jornadaId,
    asignacionesDelDia,
  });

  return {
    valores,
    errores,
    error,
    enviando,
    setCampo,
    guardar,
    advertenciaChoque,
    advertenciaTraslape,
  };
}
