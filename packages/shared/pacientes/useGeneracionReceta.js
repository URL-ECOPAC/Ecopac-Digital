import { useCallback, useEffect, useMemo, useState } from "react";

import { consultarExistencias, consultarLotesDisponibles } from "../inventario/existencias.api.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { registrarSalida } from "../inventario/movimientos.api.js";
import { generarReceta } from "./recetas.api.js";

export const MOTIVO_DE_SALIDA_POR_RECETA = "Entrega por receta medica";

export function anotarDisponibilidad(medicamentos = [], existencias = []) {
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
          : "Sin existencia disponible: no hay lotes vigentes de este medicamento.",
    };
  });
}

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

export function totalPorLote(renglones = []) {
  return renglones.reduce((total, renglon) => {
    if (!renglon.loteId) return total;
    const acumulado = total.get(renglon.loteId) ?? { cantidad: 0, bodegaId: renglon.bodegaId };
    acumulado.cantidad += Number(renglon.cantidadEntregada) || 0;
    total.set(renglon.loteId, acumulado);
    return total;
  }, new Map());
}

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
  const [avisoDeSalidas, setAvisoDeSalidas] = useState(null);

  useEffect(() => {
    let vigente = true;

    (async () => {
      setCargandoCatalogo(true);

      const [respuestaCatalogo, respuestaExistencias] = await Promise.all([
        listarMedicamentos({ busqueda: busqueda || undefined, soloActivos: true }),
        consultarExistencias({ busqueda: busqueda || undefined }),
      ]);

      if (!vigente) return;

      setCatalogo(
        anotarDisponibilidad(
          respuestaCatalogo.medicamentos ?? [],
          respuestaExistencias.existencias ?? [],
        ),
      );
      setCargandoCatalogo(false);
    })();

    return () => {
      vigente = false;
    };
  }, [busqueda]);

  const cargarLotes = useCallback(async (medicamentoId) => {
    const { lotes } = await consultarLotesDisponibles(medicamentoId);
    setLotesPorMedicamento((anteriores) => ({ ...anteriores, [medicamentoId]: lotes }));
    return lotes;
  }, []);

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

  const problemas = useMemo(
    () =>
      renglones.reduce((acumulado, renglon) => {
        const problema = renglonIncompleto(renglon);
        if (problema) acumulado[renglon.clave] = problema;
        return acumulado;
      }, {}),
    [renglones],
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
    setAvisoDeSalidas(null);

    const resultado = await generarReceta({
      consulta: consultaId,
      medico: perfilId,
      indicacionesGenerales: indicacionesGenerales || null,
      detalle: renglones.map((renglon) => ({
        medicamento: renglon.medicamentoId,
        loteId: renglon.loteId,
        dosis: renglon.dosis,
        frecuencia: renglon.frecuencia,
        duracion: renglon.duracion,
        cantidadEntregada: Number(renglon.cantidadEntregada),
      })),
    });

    if (resultado.error) {
      setEnviando(false);
      setError(resultado.error);
      return { ok: false };
    }

    const fallidas = [];
    for (const [loteId, { cantidad, bodegaId }] of totalPorLote(renglones)) {
      const salida = await registrarSalida({
        bodega_id: bodegaId,
        lote_id: loteId,
        cantidad,
        motivo: MOTIVO_DE_SALIDA_POR_RECETA,
        usuarioId: perfilId,
      });
      if (salida.error) fallidas.push(salida.error.mensaje);
    }

    setEnviando(false);
    setReceta(resultado.receta);

    if (fallidas.length > 0) {
      setAvisoDeSalidas(
        `La receta quedo generada, pero ${fallidas.length} salida(s) de inventario no se registraron: ${fallidas.join(" ")} Avisa a la administradora para que ajuste el inventario.`,
      );
    }

    return { ok: true, receta: resultado.receta };
  }, [renglones, problemas, consultaId, perfilId, indicacionesGenerales]);

  return {
    busqueda,
    setBusqueda,
    catalogo,
    cargandoCatalogo,
    lotesPorMedicamento,
    renglones,
    problemas,
    indicacionesGenerales,
    setIndicacionesGenerales,
    error,
    avisoDeSalidas,
    enviando,
    receta,
    agregarMedicamento,
    editarRenglon,
    quitarRenglon,
    guardar,
  };
}
