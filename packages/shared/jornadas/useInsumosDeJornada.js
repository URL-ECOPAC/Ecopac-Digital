import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listarContenidoDeBodegas } from "../inventario/existencias.api.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { COLUMNAS_INSUMO_PROYECTO } from "../proyectos/columnas.js";
import { CAMPOS_INSUMO_PROYECTO } from "../proyectos/campos.js";
import { validarInsumoDeProyecto } from "../proyectos/validaciones.js";
import { hayErrores } from "../validations/index.js";
import {
  actualizarInsumoDeJornada,
  agregarInsumoAJornada,
  listarInsumosDeJornada,
  quitarInsumoDeJornada,
} from "./insumos.api.js";
import { puedeGestionarInsumosDeJornada, puedeVerInsumosDeJornada } from "./permisos.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";

const SIN_EXISTENCIAS = Object.freeze({ contenido: [], cargando: false, error: null });

/**
 * Resumen de una lista de insumos previstos: suma de lo que tiene costo y cuantos no lo tienen.
 * No se finge un total para los que no se estimaron.
 *
 * @param {Array<{ costoTotalEstimado: number|null }>} insumos
 * @returns {{ totalEstimado: number, sinCosto: number }}
 */
export function resumirInsumosPrevistos(insumos = []) {
  return {
    totalEstimado:
      Math.round(
        insumos.reduce((suma, insumo) => suma + (insumo.costoTotalEstimado ?? 0), 0) * 100,
      ) / 100,
    sinCosto: insumos.filter((insumo) => insumo.costoTotalEstimado === null).length,
  };
}

/**
 * View model de la pestana Insumos del detalle de una jornada (00151): lo previsto para la jornada,
 * con alta, correccion y baja para quien la administra. Mismos campos, validacion y columnas que
 * tenian los insumos del proyecto, que ahora solo los muestra.
 *
 * Con `bodegaId` (la bodega de botiquin de la jornada) suma ademas lo que hay en esa bodega
 * (issue #911): es parte de los insumos de la jornada sin que nadie tenga que volver a anotarlo.
 * Llega aparte, en `existenciasDeBodega`, porque no es una prevision con costo estimado sino lo que
 * fisicamente hay, lote por lote.
 *
 * @param {{ jornadaId?: string, bodegaId?: string|null, rol?: string, activo?: boolean }} opciones
 *   `activo` en false no consulta nada: la pestana se carga al abrirse.
 *
 * @returns {object} Con: puedeVer, puedeGestionar, columnas, campos, catalogos, insumos, resumen, existenciasDeBodega, cargando, error, errores, ocupado, guardar, quitar, recargar.
 */
export function useInsumosDeJornada({ jornadaId, bodegaId = null, rol, activo = true } = {}) {
  const puedeVer = puedeVerInsumosDeJornada(rol);
  const puedeGestionar = puedeGestionarInsumosDeJornada(rol);

  const [insumos, setInsumos] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});
  const operacionEnCurso = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    if (!activo || !jornadaId || !puedeVer) {
      setInsumos([]);
      return;
    }
    setCargando(true);
    const { insumos: filas, error: fallo } = await listarInsumosDeJornada(jornadaId);
    setInsumos(filas);
    setError(fallo);
    setCargando(false);
  }, [activo, jornadaId, puedeVer]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Lo que hay en la bodega de botiquin (issue #911).
  const [existenciasDeBodega, setExistenciasDeBodega] = useState(SIN_EXISTENCIAS);

  const cargarExistencias = useCallback(async () => {
    if (!activo || !bodegaId || !puedeVer) {
      setExistenciasDeBodega(SIN_EXISTENCIAS);
      return;
    }
    setExistenciasDeBodega((actual) => ({ ...actual, cargando: true }));
    const { contenido, error: fallo } = await listarContenidoDeBodegas([bodegaId]);
    setExistenciasDeBodega({ contenido, cargando: false, error: fallo?.mensaje ?? null });
  }, [activo, bodegaId, puedeVer]);

  useEffect(() => {
    cargarExistencias();
  }, [cargarExistencias]);

  // Catalogo de articulos: el mismo de "Registrar ingreso al inventario".
  useEffect(() => {
    if (!activo || !puedeGestionar) return undefined;
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
  }, [activo, puedeGestionar]);

  // Un articulo figura una vez por jornada: el selector no ofrece los que ya estan.
  const articulosDisponibles = useMemo(() => {
    const yaPrevistos = new Set(insumos.map((insumo) => insumo.medicamentoId));
    return articulos.filter((articulo) => !yaPrevistos.has(articulo.value));
  }, [articulos, insumos]);

  const conUnaOperacion = useCallback(async (operacion) => {
    if (operacionEnCurso.current) return { ok: false, enCurso: true };
    operacionEnCurso.current = true;
    setOcupado(true);
    try {
      return await operacion();
    } finally {
      operacionEnCurso.current = false;
      setOcupado(false);
    }
  }, []);

  /** Agrega (`insumoId` null) o corrige un insumo previsto. */
  const guardar = useCallback(
    (insumoId, datos) =>
      conUnaOperacion(async () => {
        if (!puedeGestionar || !jornadaId) return { ok: false };
        const erroresDeValidacion = validarInsumoDeProyecto(datos, { esAlta: !insumoId });
        setErrores(erroresDeValidacion);
        if (hayErrores(erroresDeValidacion)) return { ok: false, errores: erroresDeValidacion };

        const resultado = insumoId
          ? await actualizarInsumoDeJornada(insumoId, datos)
          : await agregarInsumoAJornada(jornadaId, datos);
        if (resultado.error) return { ok: false, error: resultado.error };

        await cargar();
        return { ok: true };
      }),
    [conUnaOperacion, puedeGestionar, jornadaId, cargar],
  );

  /** Quita un insumo. `ok: false` sin error: la base no dejo quitarlo (RLS). */
  const quitar = useCallback(
    (insumoId) =>
      conUnaOperacion(async () => {
        if (!puedeGestionar) return { ok: false, error: null };
        const { quitado, error: fallo } = await quitarInsumoDeJornada(insumoId);
        setError(fallo);
        if (fallo) return { ok: false, error: fallo };
        if (!quitado) return { ok: false, error: null };
        await cargar();
        return { ok: true, error: null };
      }),
    [conUnaOperacion, puedeGestionar, cargar],
  );

  // Se recarga sola cuando cambian estas tablas (00163).
  useCambiosEnTiempoReal(["jornada_insumos"], cargar);
  useCambiosEnTiempoReal(["existencias"], cargarExistencias, {
    activo: Boolean(activo && bodegaId),
  });

  return {
    puedeVer,
    puedeGestionar,
    columnas: COLUMNAS_INSUMO_PROYECTO,
    campos: CAMPOS_INSUMO_PROYECTO,
    catalogos: { articulos: articulosDisponibles },
    insumos,
    resumen: resumirInsumosPrevistos(insumos),
    existenciasDeBodega,
    cargando,
    error,
    errores,
    ocupado,
    guardar,
    quitar,
    recargar: cargar,
  };
}
