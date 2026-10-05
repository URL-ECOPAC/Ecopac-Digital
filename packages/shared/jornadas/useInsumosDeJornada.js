import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  listarContenidoDeBodegas,
  valorizarContenidoDeBodega,
} from "../inventario/existencias.api.js";
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
import { ESTADOS_JORNADA } from "../enums.js";
import { listarJornadas } from "./api.js";
import { listarConsumoDeInsumosDeJornada } from "./bodega.api.js";

const SIN_EXISTENCIAS = Object.freeze({ contenido: [], cargando: false, error: null });

/**
 * Lo que se puede devolver de la bodega movil: cada lote vigente, hasta lo que le queda a la
 * jornada (00186). Lo que hay en la bodega y no es de esta jornada -el sobrante que ya paso a otra,
 * o lo que entro sin jornada- no se ofrece: se devuelve desde la jornada que lo tiene. Pura y
 * exportada para probarla sin montar el hook.
 *
 * @param {Array<{ loteId: string, cantidadDisponible: number, vencido?: boolean }>} contenido
 *   Lo que hay en la bodega (listarContenidoDeBodegas()).
 * @param {Array<{ loteId: string, queda: number }>} consumo Filas de listarConsumoDeInsumosDeJornada().
 * @returns {object[]} Las filas de `contenido` que se pueden devolver, con `cantidadDisponible`
 *   recortada a lo que le queda a la jornada.
 */
export function lotesDevolviblesDeJornada(contenido = [], consumo = []) {
  const quedaPorLote = new Map(consumo.map((fila) => [fila.loteId, Math.max(0, fila.queda ?? 0)]));
  return contenido
    .filter((fila) => !fila.vencido)
    .map((fila) => ({
      ...fila,
      cantidadDisponible: Math.min(
        fila.cantidadDisponible ?? 0,
        quedaPorLote.get(fila.loteId) ?? 0,
      ),
    }))
    .filter((fila) => fila.cantidadDisponible > 0);
}

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
 * View model de la pestana Insumos del detalle de una jornada.
 *
 * Desde la 00178 los insumos de la jornada son lo que hay en su bodega movil (`bodegaId`), que se
 * carga desde otra bodega (useCargaDeBodegaDeJornada): llega en `existenciasDeBodega`, lote por
 * lote, y `valorDeBodega` dice cuanto vale. La lista de previstos (jornada_insumos, 00151) ya no se
 * llena: queda la de las jornadas anteriores, que se puede corregir o quitar.
 *
 * Con la bodega principal (`bodegaEsPrincipal`, 00181) no hay nada que mostrar de la bodega: su
 * existencia es la de toda la organizacion, no la de la jornada. No se consulta, y
 * `usaBodegaPrincipal` le dice a la pantalla que lo explique; lo entregado esta en Consumo.
 *
 * @param {{ jornadaId?: string, bodegaId?: string|null, bodegaEsPrincipal?: boolean, rol?: string,
 *   activo?: boolean }} opciones `activo` en false no consulta nada: la pestana se carga al abrirse.
 *
 * `lotesDevolvibles` es lo que "Devolver a otra bodega" puede ofrecer (lotesDevolviblesDeJornada)
 * y `unidadesDeOtrasJornadas`, cuanto de lo que hay en la bodega no es de esta jornada (00186).
 * `motivoBodegaOcupada` dice que la bodega la tiene otra jornada en curso: no se puede cargar
 * hasta que termine (fn_cargar_insumo_a_bodega_de_jornada lo rechaza igual).
 *
 * @returns {object} Con: puedeVer, puedeGestionar, usaBodegaPrincipal, columnas, campos, catalogos, insumos, resumen, existenciasDeBodega, valorDeBodega, lotesDevolvibles, unidadesDeOtrasJornadas, motivoBodegaOcupada, cargando, error, errores, ocupado, guardar, quitar, recargar, recargarBodega.
 */
export function useInsumosDeJornada({
  jornadaId,
  bodegaId: bodegaDeLaJornada = null,
  bodegaEsPrincipal = false,
  rol,
  activo = true,
} = {}) {
  const puedeVer = puedeVerInsumosDeJornada(rol);
  const usaBodegaPrincipal = Boolean(bodegaDeLaJornada) && bodegaEsPrincipal;
  // La bodega cuyo contenido se muestra: solo una movil.
  const bodegaId = usaBodegaPrincipal ? null : bodegaDeLaJornada;
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

  // Lo que hay en la bodega de botiquin (issue #911), y lo que le queda a la jornada de cada lote
  // (00186): sin eso, "Devolver" ofrecia el sobrante de otra jornada como si fuera de esta.
  const [existenciasDeBodega, setExistenciasDeBodega] = useState(SIN_EXISTENCIAS);
  const [consumo, setConsumo] = useState([]);
  const [otraJornadaEnCurso, setOtraJornadaEnCurso] = useState(null);

  // Otra jornada en curso con esta bodega movil (planificadas pueden compartirla, 00179).
  useEffect(() => {
    if (!activo || !bodegaId || !puedeVer) {
      setOtraJornadaEnCurso(null);
      return undefined;
    }
    let vigente = true;
    listarJornadas({ estado: ESTADOS_JORNADA.EN_CURSO }).then(({ jornadas }) => {
      if (!vigente) return;
      const otra = (jornadas ?? []).find(
        (jornada) => jornada.botiquinBodegaId === bodegaId && jornada.id !== jornadaId,
      );
      setOtraJornadaEnCurso(otra ? { id: otra.id, nombre: otra.nombre } : null);
    });
    return () => {
      vigente = false;
    };
  }, [activo, bodegaId, jornadaId, puedeVer]);

  const cargarExistencias = useCallback(async () => {
    if (!activo || !bodegaId || !puedeVer) {
      setExistenciasDeBodega(SIN_EXISTENCIAS);
      setConsumo([]);
      return;
    }
    setExistenciasDeBodega((actual) => ({ ...actual, cargando: true }));
    const [{ contenido, error: fallo }, { consumo: filas }] = await Promise.all([
      listarContenidoDeBodegas([bodegaId]),
      jornadaId ? listarConsumoDeInsumosDeJornada(jornadaId) : { consumo: [] },
    ]);
    setConsumo(filas);
    setExistenciasDeBodega({ contenido, cargando: false, error: fallo?.mensaje ?? null });
  }, [activo, bodegaId, jornadaId, puedeVer]);

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
    usaBodegaPrincipal,
    columnas: COLUMNAS_INSUMO_PROYECTO,
    campos: CAMPOS_INSUMO_PROYECTO,
    catalogos: { articulos: articulosDisponibles },
    insumos,
    resumen: resumirInsumosPrevistos(insumos),
    existenciasDeBodega,
    valorDeBodega: valorizarContenidoDeBodega(existenciasDeBodega.contenido),
    lotesDevolvibles: lotesDevolviblesDeJornada(existenciasDeBodega.contenido, consumo),
    unidadesDeOtrasJornadas: consumo.reduce((total, fila) => total + (fila.deOtros ?? 0), 0),
    motivoBodegaOcupada: otraJornadaEnCurso
      ? `La bodega está ahora en la jornada ${otraJornadaEnCurso.nombre}, que sigue en curso: ` +
        "cárgala cuando esa jornada termine."
      : null,
    cargando,
    error,
    errores,
    ocupado,
    guardar,
    quitar,
    recargar: cargar,
    recargarBodega: cargarExistencias,
  };
}
