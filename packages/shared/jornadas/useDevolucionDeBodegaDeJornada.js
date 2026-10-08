import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listarBodegas } from "../inventario/bodegas.api.js";
import { devolverDeBodegaDeJornada } from "./bodega.api.js";
import { puedeCargarBodegaDeJornada } from "./permisos.js";
import { estadoDeLaCarga } from "./useCargaDeBodegaDeJornada.js";

/**
 * Opciones de bodega destino de una devolucion: las fijas, la principal primero. Lo que sobra en
 * un botiquin no se pasa a otro (00179): eso es cargar otra jornada, y se hace desde ella. Pura y
 * exportada para probarla sin montar el hook.
 *
 * @param {{ id: string, nombre: string, esMovil?: boolean, esPrincipal?: boolean }[]} bodegas
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeBodegaDeDevolucion(bodegas) {
  return (bodegas ?? [])
    .filter((bodega) => !bodega.esMovil)
    .sort((una, otra) => Number(Boolean(otra.esPrincipal)) - Number(Boolean(una.esPrincipal)))
    .map((bodega) => ({ value: bodega.id, label: bodega.nombre }));
}

/**
 * View model de "Devolver a otra bodega" de la pestana Insumos de una jornada (00179): lo que
 * sobra en la bodega movil vuelve a una bodega fija, lote por lote. Se puede con la jornada
 * finalizada, que es cuando sobra. Los lotes vencidos no se ofrecen: esos se dan de baja desde su
 * alerta de vencimiento.
 *
 * @param {{ jornadaId?: string, bodegaId?: string|null, rol?: string,
 *   contenido?: object[], activo?: boolean, onDevuelto?: Function }} opciones `contenido` es lo que
 *   hay en la bodega movil (listarContenidoDeBodegas()). `activo` en false no consulta nada.
 * @returns {object} Con: puedeDevolver, lotes, claveLote, seleccionarLote, bodegasDestino,
 *   bodegaDestinoId, setBodegaDestinoId, cantidad, setCantidad, avisoCantidad, puedeGuardar,
 *   guardando, error, guardar.
 */
export function useDevolucionDeBodegaDeJornada({
  jornadaId,
  bodegaId = null,
  rol,
  contenido = [],
  activo = true,
  onDevuelto,
} = {}) {
  const puedeDevolver = puedeCargarBodegaDeJornada(rol) && Boolean(bodegaId);

  const lotes = useMemo(
    () => contenido.filter((fila) => !fila.vencido && fila.cantidadDisponible > 0),
    [contenido],
  );

  const [claveLote, setClaveLote] = useState("");
  const [bodegasDestino, setBodegasDestino] = useState([]);
  const [bodegaDestinoId, setBodegaDestinoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const enCurso = useRef(false);

  useEffect(() => {
    if (!activo || !puedeDevolver) return undefined;
    let vigente = true;
    listarBodegas({ esMovil: false }).then(({ bodegas }) => {
      if (!vigente) return;
      const opciones = opcionesDeBodegaDeDevolucion(bodegas);
      setBodegasDestino(opciones);
      setBodegaDestinoId((actual) => actual || opciones[0]?.value || "");
    });
    return () => {
      vigente = false;
    };
  }, [activo, puedeDevolver]);

  const lote = lotes.find((fila) => fila.loteId === claveLote) ?? null;

  /** Elige el lote y propone devolver todo lo que queda de el. */
  const seleccionarLote = useCallback(
    (loteId) => {
      setClaveLote(loteId ?? "");
      const elegido = lotes.find((fila) => fila.loteId === loteId);
      setCantidad(elegido ? String(elegido.cantidadDisponible) : "");
      setError(null);
    },
    [lotes],
  );

  const estado = estadoDeLaCarga({
    medicamentoId: lote?.medicamentoId,
    lote,
    cantidad,
    lotesDeOrigen: lotes,
  });
  const puedeGuardar = estado.puedeGuardar && Boolean(bodegaDestinoId);

  const guardar = useCallback(async () => {
    if (enCurso.current || !puedeDevolver || !puedeGuardar) return { ok: false };
    enCurso.current = true;
    setGuardando(true);
    try {
      const { error: fallo } = await devolverDeBodegaDeJornada({
        jornadaId,
        loteId: lote.loteId,
        bodegaDestinoId,
        cantidad,
      });
      setError(fallo);
      if (fallo) return { ok: false, error: fallo };
      setClaveLote("");
      setCantidad("");
      onDevuelto?.();
      return { ok: true };
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  }, [puedeDevolver, puedeGuardar, jornadaId, lote, bodegaDestinoId, cantidad, onDevuelto]);

  return {
    puedeDevolver,
    lotes,
    claveLote,
    seleccionarLote,
    bodegasDestino,
    bodegaDestinoId,
    setBodegaDestinoId: (valor) => setBodegaDestinoId(valor ?? ""),
    cantidad,
    setCantidad,
    avisoCantidad: estado.avisoCantidad,
    puedeGuardar,
    guardando,
    error,
    guardar,
  };
}
