import { useState, useMemo, useCallback } from "react";

import { esAdministrador } from "../usuarios/roles.js";

/**
 * Traduce los campos snake_case del formulario de alta de lote a los argumentos camelCase que
 * declara registrarLote() (lotes.api.js, traducidos a columnas via aColumnasDeTabla()). Se
 * exporta aparte del hook para poder probar la traduccion sin montar un componente (issue #709).
 *
 * @param {object} datosLote
 */
export function datosLoteParaRegistrar(datosLote) {
  return {
    medicamento: datosLote.medicamento_id,
    numeroLote: datosLote.numero_lote,
    proveedor: datosLote.proveedor_id,
    origen: datosLote.origen,
    cantidadIngresada: datosLote.cantidad,
    fechaIngreso: datosLote.fecha_ingreso,
    fechaVencimiento: datosLote.fecha_vencimiento,
  };
}

/**
 * Valida los datos del formulario de alta de lote acorde al DDL:
 * - fecha_vencimiento > fecha_ingreso (chk_lotes_vencimiento_posterior)
 * - cantidad > 0 (chk_lotes_cantidad_positiva)
 *
 * Se exporta aparte del hook para poder probar la validacion sin montar un componente (issue
 * #709): pedia "cantidad_ingresada" de datosLote, pero ModalAltaLote.jsx (el unico llamador)
 * manda el campo como "cantidad" -datosLoteParaRegistrar() lo traduce a cantidadIngresada recien
 * al armar los argumentos de registrarLote()-. cantidad_ingresada era siempre undefined y esta
 * validacion rechazaba TODA alta de lote, con cualquier cantidad, con el mismo mensaje generico.
 * Como handleGuardarLote() nunca llegaba a llamar registrarLote() (issue #709 la conecto por
 * primera vez), el bug nunca se habia notado.
 *
 * @param {object} datosLote
 * @returns {string|null} El mensaje de error, o null si los datos son validos.
 */
export function validarDatosDeLote(datosLote) {
  const {
    medicamento_id,
    proveedor_id,
    numero_lote,
    fecha_ingreso,
    fecha_vencimiento,
    cantidad,
    bodega_id,
  } = datosLote;

  if (!medicamento_id || !proveedor_id || !numero_lote || !bodega_id) {
    return "Todos los campos marcados con (*) son obligatorios.";
  }

  if (!fecha_ingreso || !fecha_vencimiento) {
    return "Las fechas de ingreso y vencimiento son obligatorias.";
  }

  if (new Date(fecha_vencimiento) <= new Date(fecha_ingreso)) {
    return "La fecha de vencimiento debe ser estrictamente posterior a la fecha de ingreso (chk_lotes_vencimiento_posterior).";
  }

  if (!cantidad || Number(cantidad) <= 0) {
    return "La cantidad ingresada debe ser mayor a 0 (chk_lotes_cantidad_positiva).";
  }

  return null;
}

/**
 * Hook para la gestión de lotes y alertas de caducidad (#155 / #144).
 * Cumple con la estructura DDL de lotes, existencias y alertas_caducidad.
 */
export function useGestionLotes({
  lotesIniciales = [],
  alertasIniciales = [],
  bodegas = [],
  proveedores = [],
  usuario = { id: "", rol: null },
} = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("Todas");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todos");
  const [alertas, setAlertas] = useState(alertasIniciales);
  const [errorValidacion, setErrorValidacion] = useState(null);

  // Regla de Permisos: Solo el Administrador puede registrar lotes.
  //
  // issue #689: comparaba usuario?.rol contra el literal "Administrador", con mayuscula. El
  // enum rol_usuario (00001) y usuarios/roles.js lo declaran en minuscula
  // ("administrador"), asi que esa comparacion nunca coincidia -- mismo defecto que la propia
  // InventarioPage.jsx, que es quien llama a este hook.
  const puedeRegistrarLotes = esAdministrador(usuario?.rol);

  // Ordenamiento FEFO (First Expire, First Out) + Filtrado
  const lotesFiltrados = useMemo(() => {
    const ahora = new Date();
    const termino = busqueda.trim().toLowerCase();

    return lotesIniciales
      .map((lote) => {
        const fechaVenc = new Date(lote.fecha_vencimiento);
        const diasRestantes = Math.ceil((fechaVenc - ahora) / (1000 * 60 * 60 * 24));

        let estadoAlerta = "normal";
        if (diasRestantes <= 0) {
          estadoAlerta = "danger";
        } else if (diasRestantes <= 30) {
          estadoAlerta = "warning";
        }

        // Calcular existencias por bodega seleccionada o total
        const existenciasRelacionadas = lote.existencias || [];
        const existenciaFiltrada = existenciasRelacionadas.filter(
          (e) => bodegaSeleccionada === "Todas" || e.bodega_id === bodegaSeleccionada,
        );
        const stockTotal = existenciaFiltrada.reduce(
          (acc, curr) => acc + (curr.cantidad_disponible || 0),
          0,
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

  const validarNuevoLote = useCallback((datosLote) => {
    const mensajeError = validarDatosDeLote(datosLote);
    setErrorValidacion(mensajeError);
    return mensajeError === null;
  }, []);

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
    errorValidacion,
    setErrorValidacion,
  };
}
