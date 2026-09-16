import { useCallback, useEffect, useState } from "react";

import { obtenerLote } from "./lotes.api.js";
import { useKardexMovimientos } from "./useKardexMovimientos.js";

/**
 * View model de la pantalla de detalle de un lote (issue #791): Existencias y el alertario de
 * vencimiento (issue #268/#785) navegaban a una pantalla "DetalleLote" que nunca se construyo,
 * asi que el toque en una tarjeta no llevaba a ningun lado.
 *
 * Compone dos fuentes -el lote (obtenerLote()) y su kardex (useKardexMovimientos(), ya
 * construido y probado para el kardex general)- en un solo hook, para que la pantalla solo
 * tenga que llamar a uno, mismo criterio que ya usa InventarioResumenAlertasScreen.js al
 * combinar su propio estado con useAlertasVencimiento().
 *
 * @param {string} loteId
 */
export function useDetalleLote(loteId) {
  const [lote, setLote] = useState(null);
  const [cargandoLote, setCargandoLote] = useState(true);
  const [errorLote, setErrorLote] = useState(null);

  const cargarLote = useCallback(async () => {
    if (!loteId) {
      setLote(null);
      setCargandoLote(false);
      return;
    }

    setCargandoLote(true);
    setErrorLote(null);

    const { lote: datos, error } = await obtenerLote(loteId);

    setLote(datos);
    setErrorLote(error);
    setCargandoLote(false);
  }, [loteId]);

  useEffect(() => {
    cargarLote();
  }, [cargarLote]);

  const {
    movimientos,
    cargando: cargandoMovimientos,
    error: errorMovimientos,
    recargar: recargarMovimientos,
  } = useKardexMovimientos({ loteId });

  const recargar = useCallback(
    () => Promise.all([cargarLote(), recargarMovimientos()]),
    [cargarLote, recargarMovimientos],
  );

  return {
    lote,
    movimientos,
    cargando: cargandoLote || cargandoMovimientos,
    error: errorLote ?? errorMovimientos,
    recargar,
  };
}
