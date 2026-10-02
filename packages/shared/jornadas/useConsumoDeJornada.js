import { useCallback, useEffect, useState } from "react";

import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";
import { listarConsumoDeInsumosDeJornada, resumirConsumoDeJornada } from "./bodega.api.js";
import { COLUMNAS_CONSUMO_DE_JORNADA } from "./columnas.js";
import { puedeVerInsumosDeJornada } from "./permisos.js";

/**
 * View model de la pestana Consumo del detalle de una jornada (00178): lote por lote, lo cargado a
 * su bodega movil, lo entregado en sus recetas y lo que queda, con su valor.
 *
 * Lo ve quien ve los insumos de la jornada: lleva costo (#864).
 *
 * @param {{ jornadaId?: string, rol?: string, activo?: boolean }} opciones `activo` en false no
 *   consulta nada: la pestana se carga al abrirse.
 * @returns {object} Con: puedeVer, columnas, consumo, resumen, cargando, error, recargar.
 */
export function useConsumoDeJornada({ jornadaId, rol, activo = true } = {}) {
  const puedeVer = puedeVerInsumosDeJornada(rol);
  const consulta = Boolean(jornadaId) && puedeVer && activo;

  const [consumo, setConsumo] = useState([]);
  const [cargando, setCargando] = useState(consulta);
  const [error, setError] = useState(null);

  // `silencioso`: relee sin pasar por "cargando", para que la recarga de tiempo real no vacie la
  // tabla mientras llega la nueva.
  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!consulta) {
        setConsumo([]);
        setCargando(false);
        return;
      }
      if (!silencioso) setCargando(true);
      const { consumo: filas, error: fallo } = await listarConsumoDeInsumosDeJornada(jornadaId);
      setConsumo(filas);
      setError(fallo);
      setCargando(false);
    },
    [consulta, jornadaId],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Una carga o una receta mueven existencias (00163).
  useCambiosEnTiempoReal(["existencias"], () => cargar({ silencioso: true }), { activo: consulta });

  return {
    puedeVer,
    columnas: COLUMNAS_CONSUMO_DE_JORNADA,
    consumo,
    resumen: resumirConsumoDeJornada(consumo),
    cargando,
    error,
    recargar: cargar,
  };
}
