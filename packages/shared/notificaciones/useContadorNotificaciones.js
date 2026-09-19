import { useCallback, useEffect, useState } from "react";
import { contarNoLeidas } from "./api.js";
import { suscribirCambiosDelBuzon } from "./eventos.js";

// Cada cuanto se vuelve a contar. Una incidencia nueva no avisa al cliente -no hay Realtime en
// esta tabla-, asi que el contador se pone al dia solo; un minuto es poco para quien espera y
// nada para la base (es un conteo con head: true, sin filas).
export const INTERVALO_CONTADOR_NOTIFICACIONES_MS = 60_000;

/**
 * Cuantas notificaciones sin leer tiene el perfil, para el contador de la cabecera (issue #755).
 * Se actualiza solo cada INTERVALO_CONTADOR_NOTIFICACIONES_MS y en cuanto el buzon marca algo
 * como leido.
 *
 * Un fallo al contar deja el ultimo valor conocido y lo informa en `error`: el contador es un
 * aviso, y ponerlo a cero en silencio diria "no hay nada" cuando no se sabe.
 *
 * @param {{ perfilId?: string, intervaloMs?: number }} contexto
 */
export function useContadorNotificaciones({
  perfilId,
  intervaloMs = INTERVALO_CONTADOR_NOTIFICACIONES_MS,
} = {}) {
  const [cantidad, setCantidad] = useState(0);
  const [error, setError] = useState(null);

  const contar = useCallback(async () => {
    if (!perfilId) return;
    const respuesta = await contarNoLeidas(perfilId);
    if (respuesta.error) {
      setError(respuesta.error);
      return;
    }
    setError(null);
    setCantidad(respuesta.cantidad);
  }, [perfilId]);

  useEffect(() => {
    contar();
    const temporizador = setInterval(contar, intervaloMs);
    return () => clearInterval(temporizador);
  }, [contar, intervaloMs]);

  useEffect(() => suscribirCambiosDelBuzon(contar), [contar]);

  return { cantidad, error, recargar: contar };
}
