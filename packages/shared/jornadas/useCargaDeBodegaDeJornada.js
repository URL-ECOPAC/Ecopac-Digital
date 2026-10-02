import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { consultarLotesDisponibles } from "../inventario/existencias.api.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { claveDeLoteDeSalida } from "../inventario/useRegistroSalida.js";
import { cargarInsumoABodegaDeJornada } from "./bodega.api.js";
import { puedeCargarBodegaDeJornada } from "./permisos.js";

/**
 * Que impide cargar, en el orden en que se llena el formulario. Pura y exportada para probarla sin
 * montar el hook. La base vuelve a comprobarlo todo (fn_cargar_insumo_a_bodega_de_jornada), pero su
 * mensaje no llega a la pantalla: aqui se dice por que no se puede antes de intentarlo.
 *
 * @param {{ medicamentoId?: string, lote?: object|null, cantidad?: string|number,
 *   lotesDeOrigen?: object[], cargando?: boolean }} estado
 * @returns {{ sinExistencia: boolean, avisoCantidad: string|null, puedeGuardar: boolean }}
 */
export function estadoDeLaCarga({
  medicamentoId,
  lote,
  cantidad,
  lotesDeOrigen = [],
  cargando = false,
} = {}) {
  const sinExistencia = Boolean(medicamentoId) && !cargando && lotesDeOrigen.length === 0;
  const pedida = Number(cantidad);
  const disponible = Number(lote?.cantidadDisponible ?? 0);

  let avisoCantidad = null;
  if (lote && cantidad !== "" && cantidad !== null && cantidad !== undefined) {
    if (!Number.isInteger(pedida) || pedida <= 0) {
      avisoCantidad = "La cantidad tiene que ser un número entero mayor que cero.";
    } else if (pedida > disponible) {
      avisoCantidad = `No hay existencia suficiente: el lote tiene ${disponible} en ${lote.bodega}.`;
    }
  }

  const puedeGuardar =
    !cargando && Boolean(lote) && pedida > 0 && Number.isInteger(pedida) && avisoCantidad === null;

  return { sinExistencia, avisoCantidad, puedeGuardar };
}

/**
 * View model del formulario "Cargar a la bodega" de la pestana Insumos de una jornada (00178): se
 * elige el articulo, el lote y la bodega de donde sale -cualquiera menos la de la jornada, el que
 * vence antes primero- y la cantidad. Guardar traslada ese lote a la bodega movil de la jornada.
 *
 * @param {{ jornadaId?: string, bodegaId?: string|null, rol?: string, activo?: boolean,
 *   onCargado?: Function }} opciones `activo` en false no consulta nada: el formulario se carga al
 *   abrirse.
 * @returns {object} Con: puedeCargar, articulos, medicamentoId, setMedicamentoId, lotesDeOrigen,
 *   claveLote, seleccionarLotePorClave, cantidad, setCantidad, sinExistencia, avisoCantidad,
 *   puedeGuardar, cargando, guardando, error, guardar.
 */
export function useCargaDeBodegaDeJornada({
  jornadaId,
  bodegaId = null,
  rol,
  activo = true,
  onCargado,
} = {}) {
  const puedeCargar = puedeCargarBodegaDeJornada(rol) && Boolean(bodegaId);

  const [articulos, setArticulos] = useState([]);
  const [medicamentoId, setMedicamentoIdInterno] = useState("");
  const [lotesDeOrigen, setLotesDeOrigen] = useState([]);
  const [claveLote, setClaveLote] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const enCurso = useRef(false);

  // Catalogo de articulos: el mismo de "Registrar ingreso al inventario".
  useEffect(() => {
    if (!activo || !puedeCargar) return undefined;
    let vigente = true;
    listarMedicamentos().then(({ medicamentos }) => {
      if (!vigente) return;
      setArticulos(
        (medicamentos ?? []).map((articulo) => ({
          value: articulo.id,
          label: articulo.concentracion
            ? `${articulo.nombre} (${articulo.concentracion})`
            : articulo.nombre,
        })),
      );
    });
    return () => {
      vigente = false;
    };
  }, [activo, puedeCargar]);

  // Los lotes del articulo con existencia en otra bodega, el que vence antes primero (FEFO).
  useEffect(() => {
    if (!activo || !medicamentoId) {
      setLotesDeOrigen([]);
      setClaveLote("");
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    consultarLotesDisponibles(medicamentoId).then(({ lotes, error: fallo }) => {
      if (!vigente) return;
      const deOtraBodega = (lotes ?? []).filter((lote) => lote.bodegaId !== bodegaId);
      setLotesDeOrigen(deOtraBodega);
      setClaveLote(deOtraBodega[0] ? claveDeLoteDeSalida(deOtraBodega[0]) : "");
      setError(fallo);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [activo, medicamentoId, bodegaId]);

  const lote = useMemo(
    () => lotesDeOrigen.find((fila) => claveDeLoteDeSalida(fila) === claveLote) ?? null,
    [lotesDeOrigen, claveLote],
  );

  const estado = estadoDeLaCarga({ medicamentoId, lote, cantidad, lotesDeOrigen, cargando });

  const setMedicamentoId = useCallback((valor) => {
    setMedicamentoIdInterno(valor ?? "");
    setCantidad("");
    setError(null);
  }, []);

  const guardar = useCallback(async () => {
    if (enCurso.current || !puedeCargar || !estado.puedeGuardar) return { ok: false };
    enCurso.current = true;
    setGuardando(true);
    try {
      const { error: fallo } = await cargarInsumoABodegaDeJornada({
        jornadaId,
        loteId: lote.loteId,
        bodegaOrigenId: lote.bodegaId,
        cantidad,
      });
      setError(fallo);
      if (fallo) return { ok: false, error: fallo };
      setMedicamentoIdInterno("");
      setCantidad("");
      onCargado?.();
      return { ok: true };
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  }, [puedeCargar, estado.puedeGuardar, jornadaId, lote, cantidad, onCargado]);

  return {
    puedeCargar,
    articulos,
    medicamentoId,
    setMedicamentoId,
    lotesDeOrigen,
    claveLote,
    seleccionarLotePorClave: setClaveLote,
    cantidad,
    setCantidad,
    ...estado,
    cargando,
    guardando,
    error,
    guardar,
  };
}
