import { useState, useMemo, useCallback } from "react";

import { aFechaLocal, diasHastaVencimiento } from "../formato/fechas.js";
import { esAdministrador } from "../usuarios/roles.js";

/**
 * Traduce los campos snake_case del formulario de alta de lote a los argumentos camelCase que
 * declara registrarLote() (lotes.api.js, traducidos a columnas via aColumnasDeTabla()). Se
 * exporta aparte del hook para poder probar la traduccion sin montar un componente (issue #709).
 *
 * @param {object} datosLote
 */
export function datosLoteParaRegistrar(datosLote) {
  const datos = {
    medicamento: datosLote.medicamento_id,
    numeroLote: datosLote.numero_lote,
    proveedor: datosLote.proveedor_id,
    origen: datosLote.origen,
    cantidadIngresada: datosLote.cantidad,
    fechaIngreso: datosLote.fecha_ingreso,
    fechaVencimiento: datosLote.fecha_vencimiento,
  };

  // costoUnitario es opcional (issue #752): "" (el campo vacio del formulario) se traduce a
  // ausente, no a NaN ni a 0 -- un costo desconocido no es lo mismo que un costo de cero.
  if (datosLote.costo_unitario !== undefined && datosLote.costo_unitario !== "") {
    datos.costoUnitario = Number(datosLote.costo_unitario);
  }

  return datos;
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

  if (aFechaLocal(fecha_vencimiento) <= aFechaLocal(fecha_ingreso)) {
    return "La fecha de vencimiento debe ser estrictamente posterior a la fecha de ingreso (chk_lotes_vencimiento_posterior).";
  }

  if (!cantidad || Number(cantidad) <= 0) {
    return "La cantidad ingresada debe ser mayor a 0 (chk_lotes_cantidad_positiva).";
  }

  return null;
}

/**
 * Dias restantes y estado de alerta de un lote ("normal"/"warning"/"danger" para <= 30/0 dias).
 * Pura y exportada aparte del hook por la misma razon que validarDatosDeLote() y
 * datosLoteParaRegistrar(): usa diasHastaVencimiento() (formato/fechas.js) en vez de restar
 * `new Date(fecha_vencimiento) - new Date()` a mano, que interpretaba la columna DATE como
 * medianoche UTC y corria el corte un dia en Guatemala (issue #725).
 *
 * @param {string} fechaVencimiento
 * @param {Date} [hoy]
 * @returns {{ diasRestantes: number|null, estadoAlerta: "normal"|"warning"|"danger" }}
 */
export function calcularAlertaDeLote(fechaVencimiento, hoy = new Date()) {
  const diasRestantes = diasHastaVencimiento(fechaVencimiento, hoy);

  let estadoAlerta = "normal";
  if (diasRestantes !== null) {
    if (diasRestantes <= 0) {
      estadoAlerta = "danger";
    } else if (diasRestantes <= 30) {
      estadoAlerta = "warning";
    }
  }

  return { diasRestantes, estadoAlerta };
}

/**
 * Ordenamiento FEFO (First Expire, First Out), filtrado de busqueda/bodega/categoria y alerta de
 * vencimiento sobre los lotes que devuelve listarLotes() (aLote(), lotes.api.js). Pura y
 * exportada aparte del hook -mismo criterio que validarDatosDeLote()/datosLoteParaRegistrar()-
 * para poder probarla con datos con la forma real de aLote(): fechaVencimiento y numeroLote en
 * camelCase, medicamento como el NOMBRE (una cadena, `fila.medicamento?.nombre` en aLote()), no
 * un objeto. Esta cuenta leia fecha_vencimiento/numero_lote/medicamento.nombre en snake_case o
 * como objeto anidado: contra los datos reales, diasRestantes/estadoAlerta salian siempre
 * null/"normal" y la busqueda de texto nunca encontraba nada -sin ningun error, el mismo patron
 * de contrato adivinado de las issues #818/#821, encontrado auditando el fix de #725 en el
 * navegador-. lote.existencias, en cambio, no es parte de ese bug: listarLotes()/aLote() de
 * verdad no traen existencias por bodega todavia, asi que el filtro por bodega y stockTotal se
 * quedan en 0/sin efecto hasta que se agregue esa consulta; no se inventa aqui.
 *
 * @param {object[]} lotesIniciales
 * @param {{ busqueda?: string, bodegaSeleccionada?: string, categoriaSeleccionada?: string }} filtros
 * @param {Date} [hoy]
 */
export function procesarLotes(
  lotesIniciales,
  { busqueda = "", bodegaSeleccionada = "Todas", categoriaSeleccionada = "Todos" } = {},
  hoy = new Date(),
) {
  const termino = busqueda.trim().toLowerCase();

  return lotesIniciales
    .map((lote) => {
      const { diasRestantes, estadoAlerta } = calcularAlertaDeLote(lote.fechaVencimiento, hoy);

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
        lote.medicamento?.toLowerCase().includes(termino) ||
        lote.numeroLote?.toLowerCase().includes(termino);

      const coincideBodega =
        bodegaSeleccionada === "Todas" ||
        lote.existencias?.some((e) => e.bodega_id === bodegaSeleccionada);

      const coincideCategoria =
        categoriaSeleccionada === "Todos" || lote.medicamento?.categoria === categoriaSeleccionada;

      return coincideBusqueda && coincideBodega && coincideCategoria;
    })
    .sort((a, b) => aFechaLocal(a.fechaVencimiento) - aFechaLocal(b.fechaVencimiento));
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

  const lotesFiltrados = useMemo(
    () => procesarLotes(lotesIniciales, { busqueda, bodegaSeleccionada, categoriaSeleccionada }),
    [lotesIniciales, busqueda, bodegaSeleccionada, categoriaSeleccionada],
  );

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
