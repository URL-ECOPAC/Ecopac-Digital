import { useCallback, useEffect, useMemo, useState } from "react";

import { consultarExistencias, consultarLotesDisponibles } from "../inventario/existencias.api.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { generarReceta, obtenerBodegaDeEntrega } from "./recetas.api.js";

/**
 * Anota a cada medicamento del catalogo cuanto hay disponible y si se puede recetar.
 *
 * @param {object[]} [medicamentos]
 * @param {{ medicamentoId: string, cantidadDisponible: number,
 *   fechaVencimientoProxima?: string }[]} [existencias]
 * @param {{ nombre?: string|null }|null} [bodega] La bodega de la que sale la receta (00176): el
 *   motivo de "no se puede recetar" la nombra.
 * @returns {object[]} Cada medicamento con `cantidadDisponible`, `fechaVencimientoProxima`,
 *   `seleccionable` y `motivoNoSeleccionable`.
 */
export function anotarDisponibilidad(medicamentos = [], existencias = [], bodega = null) {
  const porMedicamento = new Map(
    existencias.map((existencia) => [existencia.medicamentoId, existencia]),
  );

  return medicamentos.map((medicamento) => {
    const existencia = porMedicamento.get(medicamento.id);
    const disponible = existencia?.cantidadDisponible ?? 0;

    return {
      ...medicamento,
      cantidadDisponible: disponible,
      fechaVencimientoProxima: existencia?.fechaVencimientoProxima ?? null,
      seleccionable: disponible > 0,
      motivoNoSeleccionable:
        disponible > 0
          ? null
          : bodega?.nombre
            ? `Sin existencia en ${bodega.nombre}: no hay lotes vigentes de este medicamento en la bodega de la que sale esta receta.`
            : "Sin existencia disponible: no hay lotes vigentes de este medicamento.",
    };
  });
}

/**
 * @param {{ nombre?: string, concentracion?: string, presentacion?: string, marca?: string }} medicamento
 * @returns {string} Nombre, concentracion, presentacion y marca, separados por espacio.
 */
export function describirExistencia(medicamento) {
  return [
    medicamento.nombre,
    medicamento.concentracion,
    medicamento.presentacion,
    medicamento.marca,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Que le falta a un renglon de la receta para poder emitirla.
 *
 * @param {object} [renglon]
 * @returns {string|null} El primer dato que falta, o `null` si esta completo.
 */
export function renglonIncompleto(renglon = {}) {
  if (!renglon.medicamentoId) return "Falta elegir el medicamento.";
  if (!renglon.loteId) return "Falta elegir el lote.";
  if (!renglon.dosis) return "Falta la dosis.";
  if (!renglon.frecuencia) return "Falta la frecuencia.";
  if (!renglon.duracion) return "Falta la duracion.";
  if (!renglon.cantidadEntregada || Number(renglon.cantidadEntregada) <= 0) {
    return "La cantidad a entregar debe ser mayor que cero.";
  }
  return null;
}

/**
 * Reparte la cantidad de cada renglon entre los lotes de su medicamento: primero el lote elegido
 * y, si no alcanza, los siguientes en orden de vencimiento (los que vencen antes salen primero).
 * Dos renglones del mismo medicamento no cuentan dos veces la misma existencia: lo que toma uno
 * ya no esta para el siguiente.
 *
 * Asi una receta de 20 con un lote de 10 no se rechaza: salen 10 de ese lote y 10 del siguiente,
 * y la pantalla lo dice.
 *
 * @param {object[]} renglones Con clave, medicamentoId, loteId, bodegaId y cantidadEntregada.
 * @param {Record<string, object[]>} lotesPorMedicamento Lotes de consultarLotesDisponibles(), ya
 *   ordenados por vencimiento.
 * @returns {Record<string, { partes: { loteId: string, bodegaId: string|null,
 *   numeroLote: string|null, cantidad: number }[], faltante: number, disponible: number }>} Por
 *   clave de renglon. `faltante` es lo que no cubre ningun lote.
 */
export function repartirEntreLotes(renglones = [], lotesPorMedicamento = {}) {
  const usado = new Map();
  const claveDeLote = (lote) => `${lote.loteId}|${lote.bodegaId ?? ""}`;
  const restante = (lote) =>
    Math.max(0, (lote.cantidadDisponible ?? 0) - (usado.get(claveDeLote(lote)) ?? 0));

  const repartos = {};
  for (const renglon of renglones) {
    const lotes = lotesPorMedicamento[renglon.medicamentoId] ?? [];
    const elegido = lotes.find(
      (lote) =>
        lote.loteId === renglon.loteId &&
        (renglon.bodegaId == null || lote.bodegaId === renglon.bodegaId),
    );
    const enOrden = elegido ? [elegido, ...lotes.filter((lote) => lote !== elegido)] : lotes;
    const disponible = lotes.reduce((suma, lote) => suma + restante(lote), 0);

    let porCubrir = Number(renglon.cantidadEntregada) || 0;
    const partes = [];
    for (const lote of enOrden) {
      if (porCubrir <= 0) break;
      const tomar = Math.min(porCubrir, restante(lote));
      if (tomar <= 0) continue;
      usado.set(claveDeLote(lote), (usado.get(claveDeLote(lote)) ?? 0) + tomar);
      partes.push({
        loteId: lote.loteId,
        bodegaId: lote.bodegaId ?? null,
        numeroLote: lote.numeroLote ?? null,
        cantidad: tomar,
      });
      porCubrir -= tomar;
    }

    repartos[renglon.clave] = { partes, faltante: Math.max(0, porCubrir), disponible };
  }
  return repartos;
}

/**
 * La nota que explica de que lotes sale un renglon, cuando no es solo el elegido.
 *
 * @param {{ partes: { numeroLote: string|null, cantidad: number }[] }} [reparto]
 * @returns {string|null} `null` si todo sale de un solo lote.
 */
export function describirReparto(reparto) {
  if (!reparto || reparto.partes.length < 2) return null;
  const tramos = reparto.partes.map(
    (parte) => `${parte.cantidad} del lote ${parte.numeroLote ?? "sin numero"}`,
  );
  const lista =
    tramos.length === 2
      ? tramos.join(" y ")
      : `${tramos.slice(0, -1).join(", ")} y ${tramos[tramos.length - 1]}`;
  return `El lote elegido no alcanza: se entregan ${lista}.`;
}

/**
 * Emision de una receta: busqueda en el catalogo con su disponibilidad, lotes por medicamento,
 * renglones y emision con `fn_generar_receta`, que descuenta el inventario en la misma transaccion.
 *
 * BODEGA DE ENTREGA (00176, issue #911). Lo que se receta en una jornada sale solo de su bodega de
 * botiquin o, si no tiene, de la bodega principal. El hook la pregunta primero
 * (obtenerBodegaDeEntrega) y despues pide la disponibilidad y los lotes SOLO de esa bodega: el
 * lote sugerido es el que vence antes ahi, y el reparto entre lotes (repartirEntreLotes) nunca toma
 * de otra. La base rechaza cualquier otra bodega, asi que esto no es solo de pantalla.
 *
 * @param {object} [opciones]
 * @param {string} opciones.consultaId Consulta a la que pertenece la receta.
 * @param {string} opciones.perfilId Medico que la emite.
 * @returns {object} `{ busqueda, setBusqueda, catalogo, cargandoCatalogo, lotesPorMedicamento,
 *   bodegaDeEntrega, renglones, problemas, avisosDeReparto, indicacionesGenerales, error, enviando,
 *   receta, agregarMedicamento, ... }`.
 */
export function useGeneracionReceta({ consultaId, perfilId } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [catalogo, setCatalogo] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [lotesPorMedicamento, setLotesPorMedicamento] = useState({});
  const [renglones, setRenglones] = useState([]);
  const [indicacionesGenerales, setIndicacionesGenerales] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [receta, setReceta] = useState(null);
  // `resuelta` en false mientras se pregunta: hasta saber la bodega no se pide el catalogo, para no
  // ofrecer por un instante lo que hay en otras.
  const [bodegaDeEntrega, setBodegaDeEntrega] = useState({ bodega: null, resuelta: false });

  useEffect(() => {
    let vigente = true;
    setBodegaDeEntrega({ bodega: null, resuelta: false });
    obtenerBodegaDeEntrega(consultaId).then(({ bodega, error: fallo }) => {
      if (!vigente) return;
      // Si no se pudo saber, se ofrece todo y la base rechaza la bodega equivocada con su mensaje.
      if (fallo) setError(fallo);
      setBodegaDeEntrega({ bodega, resuelta: true });
      setLotesPorMedicamento({});
    });
    return () => {
      vigente = false;
    };
  }, [consultaId]);

  const bodegaId = bodegaDeEntrega.bodega?.id;

  useEffect(() => {
    if (!bodegaDeEntrega.resuelta) return undefined;
    let vigente = true;

    (async () => {
      setCargandoCatalogo(true);

      const [respuestaCatalogo, respuestaExistencias] = await Promise.all([
        listarMedicamentos({ busqueda: busqueda || undefined, soloActivos: true }),
        consultarExistencias({ busqueda: busqueda || undefined, bodega: bodegaId }),
      ]);

      if (!vigente) return;

      setCatalogo(
        anotarDisponibilidad(
          respuestaCatalogo.medicamentos ?? [],
          respuestaExistencias.existencias ?? [],
          bodegaDeEntrega.bodega,
        ),
      );
      setCargandoCatalogo(false);
    })();

    return () => {
      vigente = false;
    };
  }, [busqueda, bodegaDeEntrega, bodegaId]);

  const cargarLotes = useCallback(
    async (medicamentoId) => {
      const { lotes } = await consultarLotesDisponibles(medicamentoId, { bodega: bodegaId });
      setLotesPorMedicamento((anteriores) => ({ ...anteriores, [medicamentoId]: lotes }));
      return lotes;
    },
    [bodegaId],
  );

  const agregarMedicamento = useCallback(
    async (medicamento) => {
      if (!medicamento.seleccionable)
        return { ok: false, motivo: medicamento.motivoNoSeleccionable };

      const lotes = lotesPorMedicamento[medicamento.id] ?? (await cargarLotes(medicamento.id));

      setRenglones((anteriores) => [
        ...anteriores,
        {
          clave: `${medicamento.id}-${anteriores.length}`,
          medicamentoId: medicamento.id,
          medicamento: describirExistencia(medicamento),
          loteId: lotes[0]?.loteId ?? null,
          bodegaId: lotes[0]?.bodegaId ?? null,
          dosis: "",
          frecuencia: "",
          duracion: "",
          cantidadEntregada: "",
        },
      ]);

      return { ok: true };
    },
    [lotesPorMedicamento, cargarLotes],
  );

  const editarRenglon = useCallback((clave, campo, valor) => {
    setRenglones((anteriores) =>
      anteriores.map((renglon) =>
        renglon.clave === clave ? { ...renglon, [campo]: valor } : renglon,
      ),
    );
  }, []);

  const quitarRenglon = useCallback((clave) => {
    setRenglones((anteriores) => anteriores.filter((renglon) => renglon.clave !== clave));
  }, []);

  const repartos = useMemo(
    () => repartirEntreLotes(renglones, lotesPorMedicamento),
    [renglones, lotesPorMedicamento],
  );

  const problemas = useMemo(
    () =>
      renglones.reduce((acumulado, renglon) => {
        const reparto = repartos[renglon.clave];
        const problema =
          renglonIncompleto(renglon) ??
          (reparto?.faltante > 0
            ? `Solo hay ${reparto.disponible} disponibles de este medicamento entre todos sus lotes.`
            : null);
        if (problema) acumulado[renglon.clave] = problema;
        return acumulado;
      }, {}),
    [renglones, repartos],
  );

  // La nota de cada renglon que sale de mas de un lote.
  const avisosDeReparto = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(repartos)
          .map(([clave, reparto]) => [clave, describirReparto(reparto)])
          .filter(([, aviso]) => aviso),
      ),
    [repartos],
  );

  const guardar = useCallback(async () => {
    if (renglones.length === 0) {
      setError({ mensaje: "Una receta necesita al menos un medicamento." });
      return { ok: false };
    }

    if (Object.keys(problemas).length > 0) {
      setError({ mensaje: "Completa los datos de cada medicamento antes de generar la receta." });
      return { ok: false };
    }

    setEnviando(true);
    setError(null);

    // Una sola llamada: fn_generar_receta (00112) emite la receta y registra la salida de
    // inventario en la misma transaccion. Antes esto era generarReceta() y despues un bucle de
    // registrarSalida() por lote, y si una de esas salidas fallaba la receta ya estaba emitida:
    // el medicamento salia de la bodega y el sistema lo seguia contando (issue #711). Ahora un
    // fallo en el descuento devuelve error y no deja receta.
    const resultado = await generarReceta({
      consulta: consultaId,
      medico: perfilId,
      indicacionesGenerales: indicacionesGenerales || null,
      // Un renglon por lote: receta_detalle guarda un lote por fila, asi que lo que se reparte
      // entre varios lotes (repartirEntreLotes) sale como varias filas con la misma indicacion.
      detalle: renglones.flatMap((renglon) =>
        repartos[renglon.clave].partes.map((parte) => ({
          medicamento: renglon.medicamentoId,
          loteId: parte.loteId,
          // La bodega la exige la funcion cuando el renglon trae lote: existencias esta
          // particionada por (lote, bodega) desde la 00047.
          bodegaId: parte.bodegaId,
          dosis: renglon.dosis,
          frecuencia: renglon.frecuencia,
          duracion: renglon.duracion,
          cantidadEntregada: parte.cantidad,
        })),
      ),
    });

    setEnviando(false);

    if (resultado.error) {
      setError(resultado.error);
      return { ok: false };
    }

    setReceta(resultado.receta);
    return { ok: true, receta: resultado.receta };
  }, [renglones, repartos, problemas, consultaId, perfilId, indicacionesGenerales]);

  return {
    busqueda,
    setBusqueda,
    catalogo,
    cargandoCatalogo,
    lotesPorMedicamento,
    bodegaDeEntrega: bodegaDeEntrega.bodega,
    renglones,
    problemas,
    avisosDeReparto,
    indicacionesGenerales,
    setIndicacionesGenerales,
    error,
    enviando,
    receta,
    agregarMedicamento,
    editarRenglon,
    quitarRenglon,
    guardar,
  };
}
