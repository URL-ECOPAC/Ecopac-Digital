// View model de la pestana Caja de Presupuestos (00168): cuanto hay en la caja y de donde entro o
// a que jornada salio cada parte.

import { useCallback, useEffect, useState } from "react";

import { listarMovimientosDeCaja, obtenerSaldoDeCaja } from "./caja.api.js";
import { COLUMNAS_MOVIMIENTO_CAJA } from "./columnas.js";
import { permisosDeOrigenDePresupuesto } from "./permisos.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";

/**
 * @param {{ rol?: string }} [opciones]
 * @returns {object} Con: puedeVer, saldo, movimientos, columnas, cargando, error, recargar.
 */
export function useCajaDePresupuesto({ rol } = {}) {
  // La caja la ve quien ve los aportes (politica de movimientos_de_caja, 00168).
  const { puedeVer } = permisosDeOrigenDePresupuesto(rol);

  const [saldo, setSaldo] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(puedeVer);
  const [error, setError] = useState(null);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!puedeVer) {
        setCargando(false);
        return;
      }
      if (!silencioso) setCargando(true);
      const [deSaldo, deMovimientos] = await Promise.all([
        obtenerSaldoDeCaja(),
        listarMovimientosDeCaja(),
      ]);
      setSaldo(deSaldo.saldo);
      setMovimientos(deMovimientos.movimientos);
      setError(deSaldo.error ?? deMovimientos.error);
      setCargando(false);
    },
    [puedeVer],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Se recarga sola cuando entra o sale dinero de la caja.
  useCambiosEnTiempoReal(["movimientos_de_caja"], () => cargar({ silencioso: true }), {
    activo: puedeVer,
  });

  return {
    puedeVer,
    saldo,
    movimientos,
    columnas: COLUMNAS_MOVIMIENTO_CAJA,
    cargando,
    error,
    recargar: () => cargar(),
  };
}
