import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ESTADOS_JORNADA } from "../enums.js";
import {
  consultarLotesDisponibles,
  tieneExistenciaVencida,
} from "../inventario/existencias.api.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { claveDeLoteDeSalida } from "../inventario/useRegistroSalida.js";
import { listarJornadas } from "./api.js";
import { cargarInsumoABodegaDeJornada } from "./bodega.api.js";
import { puedeCargarBodegaDeJornada } from "./permisos.js";

/**
 * Por que no hay lotes que cargar de un articulo (issue #925): no es lo mismo que no haya nada a
 * que lo que hay este vencido, y el mensaje de antes ("registrala primero en Inventario") mandaba a
 * registrar de nuevo algo que ya estaba.
 *
 * @param {{ vencida?: boolean }} [motivo]
 * @returns {string}
 */
export function mensajeDeCargaSinExistencia({ vencida = false } = {}) {
  return vencida
    ? "Lo que hay de este artículo está vencido: se da de baja desde su alerta, no se carga."
    : "No hay existencia de este artículo en otra bodega: regístrala primero en Inventario.";
}

/**
 * Los lotes de origen con la jornada en curso que tiene su bodega, si la hay (3B, 00186): cargar
 * desde ahi queda como devuelto en esa jornada y como cargado en esta. Pura y exportada para
 * probarla sin montar el hook.
 *
 * @param {object[]} lotes Filas de consultarLotesDisponibles().
 * @param {Record<string, { id: string, nombre: string }>} jornadasEnCursoPorBodega
 * @returns {object[]} Las mismas filas con `jornadaDeOrigen` (`{ id, nombre }` o null).
 */
export function conJornadaDeOrigen(lotes = [], jornadasEnCursoPorBodega = {}) {
  return lotes.map((lote) => {
    const jornada = jornadasEnCursoPorBodega[lote.bodegaId];
    return {
      ...lote,
      jornadaDeOrigen: jornada ? { id: jornada.id, nombre: jornada.nombre } : null,
    };
  });
}

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
 * Un lote que esta en la bodega movil de otra jornada en curso se puede cargar (3B, 00186): queda
 * registrado como devuelto alla y cargado aqui, y `avisoOrigen` lo dice antes de guardar.
 *
 * @returns {object} Con: puedeCargar, articulos, medicamentoId, setMedicamentoId, lotesDeOrigen,
 *   claveLote, seleccionarLotePorClave, cantidad, setCantidad, sinExistencia, mensajeSinExistencia,
 *   avisoCantidad, avisoOrigen, puedeGuardar, cargando, guardando, error, guardar.
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
  const [existenciaVencida, setExistenciaVencida] = useState(false);
  const [jornadasEnCursoPorBodega, setJornadasEnCursoPorBodega] = useState({});
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

  // Que bodega movil esta en que jornada en curso, para nombrarla junto al lote (3B).
  useEffect(() => {
    if (!activo || !puedeCargar) return undefined;
    let vigente = true;
    listarJornadas({ estado: ESTADOS_JORNADA.EN_CURSO }).then(({ jornadas }) => {
      if (!vigente) return;
      const porBodega = {};
      for (const jornada of jornadas ?? []) {
        if (jornada.botiquinBodegaId && jornada.id !== jornadaId) {
          porBodega[jornada.botiquinBodegaId] = jornada;
        }
      }
      setJornadasEnCursoPorBodega(porBodega);
    });
    return () => {
      vigente = false;
    };
  }, [activo, puedeCargar, jornadaId]);

  // Los lotes del articulo con existencia en otra bodega, el que vence antes primero (FEFO).
  useEffect(() => {
    if (!activo || !medicamentoId) {
      setLotesDeOrigen([]);
      setClaveLote("");
      setExistenciaVencida(false);
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    consultarLotesDisponibles(medicamentoId).then(async ({ lotes, error: fallo }) => {
      if (!vigente) return;
      const deOtraBodega = (lotes ?? []).filter((lote) => lote.bodegaId !== bodegaId);
      // Sin lotes que cargar, se averigua si es porque lo que hay esta vencido.
      const { vencida } =
        deOtraBodega.length === 0 && !fallo
          ? await tieneExistenciaVencida(medicamentoId)
          : { vencida: false };
      if (!vigente) return;
      setExistenciaVencida(vencida);
      setLotesDeOrigen(deOtraBodega);
      setClaveLote(deOtraBodega[0] ? claveDeLoteDeSalida(deOtraBodega[0]) : "");
      setError(fallo);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [activo, medicamentoId, bodegaId]);

  const lotesConJornada = useMemo(
    () => conJornadaDeOrigen(lotesDeOrigen, jornadasEnCursoPorBodega),
    [lotesDeOrigen, jornadasEnCursoPorBodega],
  );

  const lote = useMemo(
    () => lotesConJornada.find((fila) => claveDeLoteDeSalida(fila) === claveLote) ?? null,
    [lotesConJornada, claveLote],
  );

  const avisoOrigen = lote?.jornadaDeOrigen
    ? `Este lote está en la bodega de la jornada ${lote.jornadaDeOrigen.nombre}, que sigue en ` +
      "curso: se registra como devuelto en esa jornada y como cargado en esta."
    : null;

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
    lotesDeOrigen: lotesConJornada,
    claveLote,
    seleccionarLotePorClave: setClaveLote,
    cantidad,
    setCantidad,
    ...estado,
    mensajeSinExistencia: mensajeDeCargaSinExistencia({ vencida: existenciaVencida }),
    avisoOrigen,
    cargando,
    guardando,
    error,
    guardar,
  };
}
