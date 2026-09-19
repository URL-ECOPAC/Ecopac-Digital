import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from "./api.js";
import { agruparPorCategoria } from "./categorias.js";
import { avisarCambioDelBuzon } from "./eventos.js";
import {
  FILTROS_NOTIFICACIONES_VACIOS,
  filtrarNotificaciones,
  hayFiltrosDeNotificaciones,
} from "./filtros.js";

/**
 * View model de las notificaciones (issue #755). Sirve igual a la ventana dedicada
 * (NotificacionesPage en la web, NotificacionesScreen en el movil) y a la ventana emergente de la
 * campana de la web, que solo usa las mas recientes.
 *
 * Por defecto las notificaciones van en orden de llegada, la mas reciente arriba. `filtros` las
 * acota por texto, categoria y estado de lectura (filtros.js); `agrupar` reparte lo que queda por
 * categoria sin cambiar el orden dentro de cada grupo. `notificaciones` y `grupos` ya vienen
 * filtrados; `noLeidas` cuenta todo el buzon, no solo lo filtrado.
 *
 * Marcar como leida escribe en la base. Si falla, lo dice `errorAccion` y la notificacion sigue
 * sin leer: no se marca solo en pantalla.
 *
 * @param {{ perfilId?: string }} contexto
 */
export function useBuzonNotificaciones({ perfilId } = {}) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);
  const [agrupar, setAgrupar] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_NOTIFICACIONES_VACIOS);

  // Mismo resguardo contra respuestas fuera de orden que useAlertasVencimiento().
  const peticionVigente = useRef(0);

  const consultar = useCallback(async () => {
    if (!perfilId) return;

    peticionVigente.current += 1;
    const idDeEstaPeticion = peticionVigente.current;

    setCargando(true);
    setError(null);

    const respuesta = await listarNotificaciones(perfilId);

    if (idDeEstaPeticion !== peticionVigente.current) return;

    if (respuesta.error) {
      setError(respuesta.error);
      setCargando(false);
      return;
    }

    setNotificaciones(respuesta.notificaciones);
    setCargando(false);
  }, [perfilId]);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const filtradas = useMemo(
    () => filtrarNotificaciones(notificaciones, filtros),
    [notificaciones, filtros],
  );
  const grupos = useMemo(() => agruparPorCategoria(filtradas), [filtradas]);
  const noLeidas = useMemo(() => notificaciones.filter((n) => !n.leida).length, [notificaciones]);

  const setFiltro = useCallback(
    (id, valor) => setFiltros((actuales) => ({ ...actuales, [id]: valor })),
    [],
  );
  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_NOTIFICACIONES_VACIOS), []);

  /**
   * Marca la notificacion como leida (si no lo estaba) antes de que la pantalla navegue a su
   * destino. Devuelve false si no se pudo marcar: la pantalla no navega y muestra errorAccion.
   */
  const abrir = useCallback(
    async (notificacion) => {
      setErrorAccion(null);
      if (notificacion.leida) return true;

      const respuesta = await marcarLeida(notificacion.id);
      if (respuesta.error) {
        setErrorAccion(respuesta.error);
        return false;
      }

      await consultar();
      avisarCambioDelBuzon();
      return true;
    },
    [consultar],
  );

  const marcarTodas = useCallback(async () => {
    setErrorAccion(null);
    const respuesta = await marcarTodasLeidas(perfilId);
    if (respuesta.error) {
      setErrorAccion(respuesta.error);
      return false;
    }

    await consultar();
    avisarCambioDelBuzon();
    return true;
  }, [perfilId, consultar]);

  return {
    notificaciones: filtradas,
    total: notificaciones.length,
    grupos,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: hayFiltrosDeNotificaciones(filtros),
    agrupar,
    setAgrupar,
    noLeidas,
    cargando,
    error,
    errorAccion,
    recargar: consultar,
    abrir,
    marcarTodas,
  };
}
