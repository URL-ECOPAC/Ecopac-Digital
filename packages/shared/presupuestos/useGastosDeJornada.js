// View model de la pestana Gastos del detalle de una jornada: sus gastos y como van contra su
// presupuesto. Los gastos de todas las jornadas siguen en Presupuestos; aqui solo los de esta.

import { useCallback, useEffect, useState } from "react";

import { listarNombresDePerfiles } from "../usuarios/api.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";
import { ESTADOS_DE_GASTO } from "../enums.js";
import { listarGastos, obtenerPresupuestoJornada } from "./api.js";
import { COLUMNAS_GASTO_DE_JORNADA } from "./columnas.js";
import { puedeAprobarGasto, puedeRegistrarGasto, puedeVerTodosLosGastos } from "./permisos.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";

/**
 * Como va el gasto de una jornada contra su presupuesto. `disponible` descuenta tambien lo
 * pendiente de aprobacion, porque la base ya lo cuenta como comprometido (00159): es lo que queda
 * para registrar gastos nuevos.
 *
 * @param {{ asignado: number, gastado: number, pendiente: number }|null} presupuesto Lo que
 *   devuelve obtenerPresupuestoJornada().
 * @returns {{ asignado: number, aprobado: number, pendiente: number, disponible: number }|null}
 */
export function resumirGastosDeJornada(presupuesto) {
  if (!presupuesto) return null;
  const centavos = (valor) => Math.round(valor * 100) / 100;
  return {
    asignado: centavos(presupuesto.asignado),
    aprobado: centavos(presupuesto.gastado),
    pendiente: centavos(presupuesto.pendiente),
    disponible: centavos(presupuesto.asignado - presupuesto.gastado - presupuesto.pendiente),
  };
}

/**
 * @param {{ jornadaId?: string, rol?: string, activo?: boolean }} opciones `activo` en false no
 *   consulta nada: la pestana se carga al abrirse.
 * @returns {object} Con: puedeVer, puedeRegistrar, estadoInicial, columnas, catalogos, gastos,
 *   resumen, cargando, error, recargar.
 */
export function useGastosDeJornada({ jornadaId, rol, activo = true } = {}) {
  // Espejo de la politica de SELECT de gastos (00148): fuera de esto, RLS no entrega filas.
  const puedeVer = puedeVerTodosLosGastos(rol);
  const consulta = Boolean(jornadaId) && puedeVer && activo;

  const [gastos, setGastos] = useState([]);
  const [presupuesto, setPresupuesto] = useState(null);
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(consulta);
  const [error, setError] = useState(null);

  // `silencioso`: relee sin pasar por "cargando", para que la recarga de tiempo real no vacie la
  // lista mientras llega la nueva (como en useDetalleJornada).
  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!consulta) {
        setCargando(false);
        return;
      }
      if (!silencioso) setCargando(true);
      const [lista, totales] = await Promise.all([
        listarGastos({ jornada_id: jornadaId }),
        obtenerPresupuestoJornada(jornadaId),
      ]);
      setGastos(lista.gastos);
      setPresupuesto(totales.presupuesto);
      setError(lista.error ?? totales.error);
      setCargando(false);
    },
    [consulta, jornadaId],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Nombres de todas las personas (00161): la columna Encargado los necesita aunque quien mira no
  // tenga Colaboradores. Si fallan, la lista se queda y la columna sale en blanco.
  useEffect(() => {
    if (!consulta) return undefined;
    let vigente = true;
    listarNombresDePerfiles().then(({ perfiles: filas }) => {
      if (vigente) {
        setPerfiles(filas.map((fila) => ({ value: fila.id, label: nombreCompletoDe(fila) })));
      }
    });
    return () => {
      vigente = false;
    };
  }, [consulta]);

  // Se recarga sola cuando cambian estas tablas (00163): un gasto nuevo o aprobado, o un aporte
  // que mueve el presupuesto.
  useCambiosEnTiempoReal(
    ["gastos", "jornadas", "jornada_presupuesto_origen"],
    () => cargar({ silencioso: true }),
    { activo: consulta },
  );

  return {
    puedeVer,
    puedeRegistrar: puedeRegistrarGasto(rol),
    // Lo que registra quien aprueba entra aprobado (la base lo autoaprueba, 00109); lo demas,
    // pendiente de aprobacion.
    estadoInicial: puedeAprobarGasto(rol) ? ESTADOS_DE_GASTO.APROBADO : ESTADOS_DE_GASTO.PENDIENTE,
    columnas: COLUMNAS_GASTO_DE_JORNADA,
    catalogos: { perfiles },
    gastos,
    resumen: resumirGastosDeJornada(presupuesto),
    cargando,
    error,
    recargar: () => cargar(),
  };
}
