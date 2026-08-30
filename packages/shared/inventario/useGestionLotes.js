import { useState, useMemo, useCallback } from "react";

/**
 * Hook para la gestión de lotes y alertas de caducidad (#155 / #144).
 * Cumple con la estructura DDL de lotes, existencias y alertas_caducidad.
 */
export function useGestionLotes({
  lotesIniciales = [],
  alertasIniciales = [],
  bodegas = [],
  proveedores = [],
  usuario = { id: "", rol: "Administrador" },
} = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("Todas");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todos");
  const [alertas, setAlertas] = useState(alertasIniciales);
  const [errorValidacion, setErrorValidacion] = useState(null);

  // Regla de Permisos: Solo el Administrador puede registrar lotes
  const puedeRegistrarLotes = usuario?.rol === "Administrador";

  // Ordenamiento FEFO (First Expire, First Out) + Filtrado
  const lotesFiltrados = useMemo(() => {
    const ahora = new Date();
    const termino = busqueda.trim().toLowerCase();

    return lotesIniciales
      .map((lote) => {
        const fechaVenc = new Date(lote.fecha_vencimiento);
        const diasRestantes = Math.ceil(
          (fechaVenc - ahora) / (1000 * 60 * 60 * 24)
        );

        let estadoAlerta = "normal";
        if (diasRestantes <= 0) {
          estadoAlerta = "danger";
        } else if (diasRestantes <= 30) {
          estadoAlerta = "warning";
        }

        // Calcular existencias por bodega seleccionada o total
        const existenciasRelacionadas = lote.existencias || [];
        const existenciaFiltrada = existenciasRelacionadas.filter(
          (e) => bodegaSeleccionada === "Todas" || e.bodega_id === bodegaSeleccionada
        );
        const stockTotal = existenciaFiltrada.reduce(
          (acc, curr) => acc + (curr.cantidad_disponible || 0),
          0
        );

        return { ...lote, diasRestantes, estadoAlerta, stockTotal };
      })
      .filter((lote) => {
        const coincideBusqueda =
          !termino ||
          lote.medicamento?.nombre?.toLowerCase().includes(termino) ||
          lote.medicamento?.codigo?.toLowerCase().includes(termino) ||
          lote.numero_lote?.toLowerCase().includes(termino);

        const coincideBodega =
          bodegaSeleccionada === "Todas" ||
          lote.existencias?.some((e) => e.bodega_id === bodegaSeleccionada);

        const coincideCategoria =
          categoriaSeleccionada === "Todos" ||
          lote.medicamento?.categoria === categoriaSeleccionada;

        return coincideBusqueda && coincideBodega && coincideCategoria;
      })
      .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
  }, [lotesIniciales, busqueda, bodegaSeleccionada, categoriaSeleccionada]);

  // Alertas críticas (vencidos o por vencer en <= 30 días)
  const alertasCriticas = useMemo(() => {
    return lotesFiltrados.filter((item) => item.estadoAlerta !== "normal");
  }, [lotesFiltrados]);

  // Validaciones del Formulario acorde al DDL:
  // - fecha_vencimiento > fecha_ingreso (chk_lotes_vencimiento_posterior)
  // - cantidad_ingresada > 0 (chk_lotes_cantidad_positiva)
  const validarNuevoLote = useCallback((datosLote) => {
    const {
      medicamento_id,
      proveedor_id,
      numero_lote,
      fecha_ingreso,
      fecha_vencimiento,
      cantidad_ingresada,
      bodega_id,
    } = datosLote;

    if (!medicamento_id || !proveedor_id || !numero_lote || !bodega_id) {
      setErrorValidacion("Todos los campos marcados con (*) son obligatorios.");
      return false;
    }

    if (!fecha_ingreso || !fecha_vencimiento) {
      setErrorValidacion("Las fechas de ingreso y vencimiento son obligatorias.");
      return false;
    }

    if (new Date(fecha_vencimiento) <= new Date(fecha_ingreso)) {
      setErrorValidacion(
        "La fecha de vencimiento debe ser estrictamente posterior a la fecha de ingreso (chk_lotes_vencimiento_posterior)."
      );
      return false;
    }

    if (!cantidad_ingresada || Number(cantidad_ingresada) <= 0) {
      setErrorValidacion("La cantidad ingresada debe ser mayor a 0 (chk_lotes_cantidad_positiva).");
      return false;
    }

    setErrorValidacion(null);
    return true;
  }, []);

  // Validación para atención de alerta acorde a chk_alertas_caducidad_cierre_coherente
  const atenderAlertaCaducidad = useCallback(
    (alertaId, accionRealizada) => {
      if (!["donado", "reubicado", "descartado"].includes(accionRealizada)) {
        setErrorValidacion("Debe seleccionar una acción válida (donado, reubicado o descartado).");
        return null;
      }

      if (!usuario?.id) {
        setErrorValidacion("No se pudo identificar al usuario actual.");
        return null;
      }

      const datosCierre = {
        estado: "atendida",
        accion: accionRealizada,
        atendida_por: usuario.id,
        atendida_en: new Date().toISOString(),
      };

      setErrorValidacion(null);
      return datosCierre;
    },
    [usuario]
  );

  return {
    busqueda,
    setBusqueda,
    bodegaSeleccionada,
    setBodegaSeleccionada,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    lotesFiltrados,
    alertasCriticas,
    alertas,
    setAlertas,
    bodegas,
    proveedores,
    puedeRegistrarLotes,
    validarNuevoLote,
    atenderAlertaCaducidad,
    errorValidacion,
    setErrorValidacion,
  };
}