import { useCallback, useEffect, useMemo, useState } from "react";

import { consultarExistencias, consultarLotesDisponibles } from "../inventario/existencias.api.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { generarReceta } from "./recetas.api.js";

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

    // Una sola llamada: fn_generar_receta (00112) emite la receta y registra la salida de
    // inventario en la misma transaccion. Antes esto era generarReceta() y despues un bucle de
    // registrarSalida() por lote, y si una de esas salidas fallaba la receta ya estaba emitida:
    // el medicamento salia de la bodega y el sistema lo seguia contando (issue #711). Ahora un
    // fallo en el descuento devuelve error y no deja receta.
    const resultado = await generarReceta({
      consulta: consultaId,
      medico: perfilId,
      indicacionesGenerales: indicacionesGenerales || null,
      detalle: renglones.map((renglon) => ({
        medicamento: renglon.medicamentoId,
        loteId: renglon.loteId,
        // La bodega la exige la funcion cuando el renglon trae lote: existencias esta
        // particionada por (lote, bodega) desde la 00047.
        bodegaId: renglon.bodegaId,
        dosis: renglon.dosis,
        frecuencia: renglon.frecuencia,
        duracion: renglon.duracion,
        cantidadEntregada: Number(renglon.cantidadEntregada),
      })),
    });

    setEnviando(false);

    if (resultado.error) {
      setError(resultado.error);
      return { ok: false };
    }

    setReceta(resultado.receta);
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
    enviando,
    receta,
    agregarMedicamento,
    editarRenglon,
    quitarRenglon,
    guardar,
  };
}
