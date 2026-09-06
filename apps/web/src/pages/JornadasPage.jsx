import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  ESTADOS_JORNADA, 
  OPCIONES_ESTADO_JORNADA, 
  permisosDeJornadas, 
  transicionesDeJornadaDesde,
  agruparJornadasPorEstado,
  cambiarEstadoJornada, 
  listarCatalogosJornada, 
  listarJornadas 
} from "@ecopac/shared";

/**
 * Hook de negocio para gestionar la vista de Kanban de jornadas.
 * Maneja el estado de las columnas, la aplicación de filtros, la carga de catálogos,
 * la validación de permisos de movimiento y el flujo de cierre guiado hacia /jornadas/:id.
 */
export function useJornadasKanban(rol) {
  const [jornadas, setJornadas] = useState([]);
  const [catalogos, setCatalogos] = useState({ comunidades: [] });
  const [filtros, setFiltros] = useState({
    estado: null,
    comunidad: null,
    fechaDesde: null,
    fechaHasta: null,
  });

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [moviendo, setMoviendo] = useState(false);
  const [errorMovimiento, setErrorMovimiento] = useState(null);
  const [pedirCierreEnDetalle, setPedirCierreEnDetalle] = useState(null);

  // Determina permisos generales sobre el módulo según el rol del usuario de sesión
  const permisos = useMemo(() => permisosDeJornadas(rol), [rol]);

  // Carga inicial de datos de jornadas y catálogos necesarios para los filtros
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [listadoRes, catalogosRes] = await Promise.all([
        listarJornadas(filtros),
        listarCatalogosJornada(),
      ]);
      setJornadas(listadoRes.datos ?? []);
      setCatalogos(catalogosRes ?? { comunidades: [] });
    } catch (err) {
      setError({
        mensaje: err.message || "Error al cargar el tablero de jornadas.",
      });
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Actualiza un filtro específico y reinicia errores previos
  const setFiltro = useCallback((clave, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [clave]: valor,
    }));
  }, []);

  const descartarErrorMovimiento = useCallback(() => {
    setErrorMovimiento(null);
  }, []);

  const descartarPedidoCierre = useCallback(() => {
    setPedirCierreEnDetalle(null);
  }, []);

  /**
   * Mueve una jornada de un estado origen a uno destino.
   * Intercepta la transición 'en_curso' -> 'finalizada' para redirigir
   * al detalle de la jornada (pestaña Cierre), evitando finalizar desde el Kanban.
   */
  const moverJornada = useCallback(
    async (idJornada, estadoOrigen, estadoDestino) => {
      setErrorMovimiento(null);

      // Validación de transiciones permitidas según la máquina de estados
      const transicionesValidas = transicionesDeJornadaDesde(estadoOrigen);
      if (!transicionesValidas.includes(estadoDestino)) {
        setErrorMovimiento({
          mensaje: `No se permite cambiar la jornada directamente de ${estadoOrigen} a ${estadoDestino}.`,
        });
        return;
      }

      // Validación de permisos según la dirección del movimiento
      const esReapertura = estadoOrigen === ESTADOS_JORNADA.FINALIZADA;
      if (esReapertura && !permisos.puedeReabrir) {
        setErrorMovimiento({
          mensaje: "No tienes permisos para reabrir una jornada finalizada.",
        });
        return;
      }
      if (!esReapertura && !permisos.puedeEditar) {
        setErrorMovimiento({
          mensaje: "No tienes permisos para cambiar el estado de la jornada.",
        });
        return;
      }

      // Intercepción del cierre: Requiere confirmación y balance en la pantalla de detalle
      if (
        estadoOrigen === ESTADOS_JORNADA.EN_CURSO &&
        estadoDestino === ESTADOS_JORNADA.FINALIZADA
      ) {
        setPedirCierreEnDetalle(idJornada);
        return;
      }

      setMoviendo(true);
      try {
        await cambiarEstadoJornada(idJornada, estadoDestino);
        await cargarDatos();
      } catch (err) {
        setErrorMovimiento({
          mensaje: err.message || "No se pudo cambiar el estado de la jornada.",
        });
      } finally {
        setMoviendo(false);
      }
    },
    [permisos, cargarDatos]
  );

  // Agrupa las jornadas en sus respectivas columnas aplicando filtros locales si aplica
  const columnas = useMemo(() => {
    return agruparJornadasPorEstado(jornadas, OPCIONES_ESTADO_JORNADA);
  }, [jornadas]);

  return {
    columnas,
    filtros,
    setFiltro,
    cargando,
    error,
    recargar: cargarDatos,
    total: jornadas.length,
    catalogos,
    puedeCrear: permisos.puedeCrear,
    puedeEditar: permisos.puedeEditar,
    puedeReabrir: permisos.puedeReabrir,
    moverJornada,
    moviendo,
    errorMovimiento,
    descartarErrorMovimiento,
    pedirCierreEnDetalle,
    descartarPedidoCierre,
  };
}