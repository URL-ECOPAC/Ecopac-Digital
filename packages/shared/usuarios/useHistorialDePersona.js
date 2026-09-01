// Historial de jornadas de una persona, cargado bajo demanda.
//
// Desde que el listado y la ficha se fusionaron en una sola pantalla (VoluntariosPage.jsx), el
// perfil, sus especialidades y el conteo de jornadas ya llegan con la fila del listado
// (useUsuariosListado.js): lo unico que falta por persona es el detalle de CADA jornada, que
// solo hace falta pedir cuando esa tarjeta se expande. Por eso este hook es mas chico que el
// useFichaUsuario() que reemplaza -- ya no vuelve a pedir perfil ni especialidades, que sería
// repetir una consulta que la pantalla ya resolvio.
//
// `perfilId` en null (tarjeta cerrada) dejar el hook sin pedir nada: quien lo usa pasa
// `abierta ? fila.id : null` para que cerrar una tarjeta no dispare una consulta de mas y volver
// a abrirla la repita (sin cache entre aperturas: mismo criterio de simplicidad que el resto del
// modulo, el historial de una jornada activa puede cambiar entre una apertura y la siguiente).

import { useCallback, useEffect, useState } from "react";

import { obtenerJornadasDePersona } from "../jornadas/api.js";

/**
 * @param {string|null} perfilId
 * @returns {{
 *   historial: object[],
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 * }}
 */
export function useHistorialDePersona(perfilId) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!perfilId) {
      setHistorial([]);
      setError(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    const { jornadas, error: errorDeCarga } = await obtenerJornadasDePersona(perfilId);
    setHistorial(jornadas ?? []);
    setError(errorDeCarga);
    setCargando(false);
  }, [perfilId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { historial, cargando, error, recargar: cargar };
}
