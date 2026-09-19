// View model del contexto de jornada para la captura clinica en web.
//
// EL PROBLEMA QUE RESUELVE
//
// Un triaje, una consulta y una receta no cuelgan del paciente: cuelgan de una ATENCION, y una
// atencion cuelga de una jornada (00013, 00018, 00019). En movil eso no hace falta preguntarlo
// -la persona elige su jornada activa al entrar (useSeleccionJornada, issue #186) y desde ahi
// todas las pantallas clinicas la heredan-, asi que useConsulta (signos y consulta juntos, #840) y
// useGeneracionReceta reciben `jornadaId` ya resuelto.
//
// En web no existe esa seleccion: se entra por el modulo de pacientes, se busca a alguien y se
// abre su ficha, sin jornada por ningun lado. Por eso la web nunca tuvo captura clinica, aunque
// los tres hooks y sus tres APIs estuvieran escritos y probados desde hace meses.
//
// Lo que hace este hook es cerrar ese hueco y nada mas: resuelve QUE jornada esta en curso y
// deja elegir si hay varias. La captura en si la siguen haciendo los hooks de siempre, sin
// tocarlos, que es lo que garantiza que web y movil guarden exactamente lo mismo.
//
// No decide permisos: eso es permisos.js. No consulta la cola de la jornada: eso es
// iniciarAtencion(), que ya llaman los hooks de captura.

import { useCallback, useEffect, useMemo, useState } from "react";

import { ESTADOS_JORNADA } from "../enums.js";
import { listarJornadas } from "../jornadas/api.js";

/**
 * Jornadas en curso disponibles para registrar informacion clinica.
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.habilitado] Si es false no se consulta nada. Sirve para no pegarle
 *   a la base desde una ficha que un rol abre en modo solo lectura.
 * @returns {{
 *   jornadas: object[],
 *   jornadaId: string|null,
 *   jornada: object|null,
 *   opcionesDeJornada: {value: string, label: string}[],
 *   elegirJornada: (id: string|null) => void,
 *   hayJornadaEnCurso: boolean,
 *   motivo: string|null,
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 * }}
 */
export function useCapturaClinica({ habilitado = true } = {}) {
  const [jornadas, setJornadas] = useState([]);
  const [jornadaId, setJornadaId] = useState(null);
  const [cargando, setCargando] = useState(habilitado);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!habilitado) {
      setJornadas([]);
      setCargando(false);
      return;
    }

    setCargando(true);

    // Se filtra por estado en la consulta y no en memoria, igual que usePanelDeInicio: RLS ya
    // limita las jornadas que el rol ve (00039).
    const { jornadas: filas, error: fallo } = await listarJornadas({
      estado: ESTADOS_JORNADA.EN_CURSO,
    });

    if (fallo) {
      setError(fallo);
      setJornadas([]);
    } else {
      setError(null);
      setJornadas(filas ?? []);
    }

    setCargando(false);
  }, [habilitado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Con una sola jornada en curso -el caso normal- se elige sola: obligar a seleccionarla de una
  // lista de un elemento es un paso de mas en el unico momento en que nadie tiene tiempo.
  useEffect(() => {
    if (jornadas.length === 1) {
      setJornadaId(jornadas[0].id);
      return;
    }
    // Si la que estaba elegida deja de estar en curso (se cerro mientras la ficha estaba
    // abierta), se suelta en vez de quedarse apuntando a una jornada que ya no acepta registros.
    setJornadaId((actual) =>
      actual && jornadas.some((jornada) => jornada.id === actual) ? actual : null,
    );
  }, [jornadas]);

  const opcionesDeJornada = useMemo(
    () =>
      jornadas.map((jornada) => ({
        value: jornada.id,
        label: jornada.comunidad?.nombre
          ? `${jornada.nombre} - ${jornada.comunidad.nombre}`
          : jornada.nombre,
      })),
    [jornadas],
  );

  const jornada = useMemo(
    () => jornadas.find((fila) => fila.id === jornadaId) ?? null,
    [jornadas, jornadaId],
  );

  // El motivo se redacta aqui y no en cada pantalla: los dos casos -no hay ninguna jornada, o
  // hay varias y falta elegir- necesitan mensajes distintos, y escribirlos en la app seria
  // escribir texto de negocio dentro de un componente.
  let motivo = null;
  if (!cargando && !error) {
    if (jornadas.length === 0) {
      motivo =
        "No hay ninguna jornada en curso. La informacion clinica se registra dentro de una " +
        "jornada, asi que primero hay que iniciarla desde el modulo de Jornadas.";
    } else if (!jornadaId) {
      motivo = "Hay varias jornadas en curso: elige en cual se esta atendiendo a esta persona.";
    }
  }

  return {
    jornadas,
    jornadaId,
    jornada,
    opcionesDeJornada,
    elegirJornada: setJornadaId,
    hayJornadaEnCurso: jornadas.length > 0,
    motivo,
    cargando,
    error,
    recargar: cargar,
  };
}
