// View model de la liquidacion del sobrante de una jornada finalizada (00160). Se muestra en la
// pestana Cierre del detalle de la jornada.
//
// Por cada aporte al que le sobra dinero se elige un destino: devolverlo (una donacion vuelve a
// tener ese saldo libre; lo demas entra a la caja, 00168) o traspasarlo a otra jornada del mismo proyecto que todavia no
// termino. Por defecto se devuelve. Mientras la jornada tenga gastos pendientes de aprobar el
// sobrante todavia puede cambiar, y no se ofrece liquidar.

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ESTADOS_JORNADA,
  ETIQUETAS_ORIGEN_PRESUPUESTO,
  ORIGENES_DE_PRESUPUESTO,
} from "../enums.js";
import { formatearFechaCorta } from "../formato/fechas.js";
import { listarJornadasDelProyecto } from "../proyectos/api.js";
import { obtenerPresupuestoJornada } from "./api.js";
import { listarOrigenesDePresupuesto } from "./origenes.api.js";
import { permisosDeOrigenDePresupuesto } from "./permisos.js";
import {
  DESTINOS_DE_SOBRANTE,
  liquidarSobranteDeJornada,
  obtenerSobranteDeJornada,
} from "./sobrante.api.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";

/** A donde vuelve el sobrante de un aporte segun su origen, dicho como opcion. */
const DEVOLVER_SEGUN_ORIGEN = {
  [ORIGENES_DE_PRESUPUESTO.DONACION]: "Devolver a la donación",
  // 00168: lo que no vuelve a una donacion entra a la caja.
  [ORIGENES_DE_PRESUPUESTO.FONDOS_PROPIOS]: "Pasar a la caja",
  [ORIGENES_DE_PRESUPUESTO.APORTE_EXTERNO]: "Pasar a la caja",
  [ORIGENES_DE_PRESUPUESTO.SIN_CLASIFICAR]: "Pasar a la caja",
  [ORIGENES_DE_PRESUPUESTO.CAJA]: "Devolver a la caja",
};

/** Una copia de `objeto` sin `clave`. */
function sinClave(objeto, clave) {
  return Object.fromEntries(Object.entries(objeto).filter(([otra]) => otra !== clave));
}

/** Una jornada puede recibir sobrante mientras no haya terminado. */
const ESTADOS_QUE_RECIBEN = [ESTADOS_JORNADA.PLANIFICADA, ESTADOS_JORNADA.EN_CURSO];

/**
 * Las opciones de destino para el sobrante de un aporte. Traspasar solo se ofrece si hay a donde.
 *
 * @param {string} origen Uno de ORIGENES_DE_PRESUPUESTO.
 * @param {boolean} hayJornadasDestino
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeDestinoDeSobrante(origen, hayJornadasDestino) {
  return [
    {
      value: DESTINOS_DE_SOBRANTE.DEVOLVER,
      label: DEVOLVER_SEGUN_ORIGEN[origen] ?? "Devolver a su origen",
    },
    ...(hayJornadasDestino
      ? [{ value: DESTINOS_DE_SOBRANTE.TRASPASAR, label: "Pasar a otra jornada del proyecto" }]
      : []),
  ];
}

/**
 * Que decir cuando no hay sobrante que liquidar. Una jornada sin presupuesto no "gasto todo su
 * presupuesto": no tuvo (issue #925). Pura y exportada para probarla sin montar el hook.
 *
 * @param {{ liquidados?: object[], presupuestoAsignado?: number|string|null }} datos
 * @returns {string}
 */
export function mensajeSinSobrante({ liquidados = [], presupuestoAsignado = null } = {}) {
  if (liquidados.length > 0) return "No queda sobrante por liquidar.";
  if (!(Number(presupuestoAsignado) > 0)) {
    return "Esta jornada no tuvo presupuesto asignado: no hay sobrante.";
  }
  return "La jornada gastó todo su presupuesto: no hay sobrante.";
}

/**
 * Las decisiones que se mandan a la base, o los errores por aporte si falta elegir a donde.
 *
 * @param {{ origenId: string }[]} filas Aportes con sobrante.
 * @param {Record<string, { destino: string, jornadaDestinoId?: string|null }>} decisiones
 * @returns {{ decisiones: object[], errores: Record<string, string> }}
 */
export function armarDecisionesDeSobrante(filas, decisiones) {
  const errores = {};
  const lista = filas.map((fila) => {
    const decision = decisiones[fila.origenId] ?? { destino: DESTINOS_DE_SOBRANTE.DEVOLVER };
    if (decision.destino === DESTINOS_DE_SOBRANTE.TRASPASAR && !decision.jornadaDestinoId) {
      errores[fila.origenId] = "Elige la jornada que recibe el sobrante.";
    }
    return {
      origenId: fila.origenId,
      destino: decision.destino,
      jornadaDestinoId: decision.jornadaDestinoId ?? null,
    };
  });
  return { decisiones: lista, errores };
}

/**
 * @param {{ jornada: { id: string, estado: string, proyectoId?: string|null }|null, rol: string,
 *   onLiquidado?: () => void }} opciones `onLiquidado` avisa a la pantalla que el presupuesto de
 *   la jornada cambio.
 * @returns {object} Con: visible, puedeLiquidar, cargando, error, filas, liquidados, totalSobrante,
 *   hayGastosPendientes, mensajeSinSobrante, jornadasDestino, decisiones, errores, setDestino,
 *   setJornadaDestino, liquidar, liquidando, errorAlLiquidar, recargar.
 */
export function useSobranteDeJornada({ jornada, rol, onLiquidado } = {}) {
  const permisos = permisosDeOrigenDePresupuesto(rol);
  const jornadaId = jornada?.id ?? null;
  const proyectoId = jornada?.proyectoId ?? null;
  const visible =
    Boolean(jornada) && jornada.estado === ESTADOS_JORNADA.FINALIZADA && permisos.puedeVer;

  const [sobrantes, setSobrantes] = useState([]);
  const [origenes, setOrigenes] = useState([]);
  const [jornadasDelProyecto, setJornadasDelProyecto] = useState([]);
  const [pendiente, setPendiente] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [decisiones, setDecisiones] = useState({});
  const [errores, setErrores] = useState({});
  const [liquidando, setLiquidando] = useState(false);
  const [errorAlLiquidar, setErrorAlLiquidar] = useState(null);

  const cargar = useCallback(async () => {
    if (!visible) return;
    setCargando(true);
    const [respuestaSobrante, respuestaOrigenes, respuestaPresupuesto, respuestaJornadas] =
      await Promise.all([
        obtenerSobranteDeJornada(jornadaId),
        listarOrigenesDePresupuesto(jornadaId),
        obtenerPresupuestoJornada(jornadaId),
        permisos.puedeGestionar && proyectoId
          ? listarJornadasDelProyecto(proyectoId)
          : Promise.resolve({ jornadas: [], error: null }),
      ]);
    setSobrantes(respuestaSobrante.sobrantes);
    setOrigenes(respuestaOrigenes.origenes);
    setPendiente(respuestaPresupuesto.presupuesto?.pendiente ?? 0);
    setJornadasDelProyecto(respuestaJornadas.jornadas);
    setError(respuestaSobrante.error ?? respuestaOrigenes.error ?? respuestaPresupuesto.error);
    setCargando(false);
  }, [visible, jornadaId, proyectoId, permisos.puedeGestionar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const origenPorId = useMemo(
    () => Object.fromEntries(origenes.map((origen) => [origen.id, origen])),
    [origenes],
  );

  const aFila = useCallback(
    (sobrante) => {
      const origen = origenPorId[sobrante.origenId];
      return {
        ...sobrante,
        etiqueta:
          origen?.etiqueta ?? ETIQUETAS_ORIGEN_PRESUPUESTO[sobrante.origen] ?? sobrante.origen,
        detalle: origen?.detalle ?? null,
      };
    },
    [origenPorId],
  );

  // Lo que todavia se puede liquidar, y lo que ya se liquido antes (para mostrarlo).
  const filas = useMemo(
    () => sobrantes.filter((sobrante) => sobrante.sobrante > 0).map(aFila),
    [sobrantes, aFila],
  );
  const liquidados = useMemo(
    () => sobrantes.filter((sobrante) => sobrante.devuelto > 0).map(aFila),
    [sobrantes, aFila],
  );
  const totalSobrante = useMemo(
    () => Math.round(filas.reduce((suma, fila) => suma + fila.sobrante, 0) * 100) / 100,
    [filas],
  );

  const jornadasDestino = useMemo(
    () =>
      jornadasDelProyecto
        .filter((otra) => otra.id !== jornadaId && ESTADOS_QUE_RECIBEN.includes(otra.estado))
        .map((otra) => ({
          value: otra.id,
          label: `${otra.nombre} · ${formatearFechaCorta(otra.fecha)}`,
        })),
    [jornadasDelProyecto, jornadaId],
  );

  const setDestino = useCallback((origenId, destino) => {
    setDecisiones((anteriores) => ({
      ...anteriores,
      [origenId]: {
        destino,
        jornadaDestinoId:
          destino === DESTINOS_DE_SOBRANTE.TRASPASAR
            ? (anteriores[origenId]?.jornadaDestinoId ?? null)
            : null,
      },
    }));
    setErrores((anteriores) => sinClave(anteriores, origenId));
  }, []);

  const setJornadaDestino = useCallback((origenId, jornadaDestinoId) => {
    setDecisiones((anteriores) => ({
      ...anteriores,
      [origenId]: { destino: DESTINOS_DE_SOBRANTE.TRASPASAR, jornadaDestinoId },
    }));
    setErrores((anteriores) => sinClave(anteriores, origenId));
  }, []);

  const liquidar = useCallback(async () => {
    const armado = armarDecisionesDeSobrante(filas, decisiones);
    if (Object.keys(armado.errores).length > 0) {
      setErrores(armado.errores);
      return false;
    }

    setLiquidando(true);
    setErrorAlLiquidar(null);
    const { error: fallo } = await liquidarSobranteDeJornada(jornadaId, armado.decisiones);
    setLiquidando(false);

    if (fallo) {
      setErrorAlLiquidar(fallo);
      return false;
    }

    setDecisiones({});
    await cargar();
    onLiquidado?.();
    return true;
  }, [filas, decisiones, jornadaId, cargar, onLiquidado]);

  // Se recarga sola cuando cambian estas tablas (00163).
  useCambiosEnTiempoReal(["jornada_presupuesto_origen", "gastos"], cargar);

  return {
    visible,
    puedeLiquidar: permisos.puedeGestionar,
    cargando,
    error,
    filas,
    liquidados,
    totalSobrante,
    hayGastosPendientes: pendiente > 0,
    mensajeSinSobrante: mensajeSinSobrante({
      liquidados,
      presupuestoAsignado: jornada?.presupuestoAsignado,
    }),
    jornadasDestino,
    opcionesDeDestino: (origen) => opcionesDeDestinoDeSobrante(origen, jornadasDestino.length > 0),
    decisiones,
    errores,
    setDestino,
    setJornadaDestino,
    liquidar,
    liquidando,
    errorAlLiquidar,
    recargar: cargar,
  };
}
