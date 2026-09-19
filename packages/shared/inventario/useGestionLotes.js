import { useState, useMemo } from "react";

import { aFechaLocal, diasHastaVencimiento } from "../formato/fechas.js";

// Aqui vivian valoresInicialesDeLote(), datosLoteParaRegistrar() y validarDatosDeLote(): las tres
// eran el formulario de "Registrar lote", que se retiro con la issue #846 porque creaba lotes sin
// existencias en ninguna bodega. Lo que describe un lote sigue en CAMPOS_LOTE (campos.js), de
// donde sale CAMPOS_CORRECCION_LOTE, que es el unico formulario de lote que queda.

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
export function useGestionLotes({ lotesIniciales = [], alertasIniciales = [] } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("Todas");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todos");
  const [alertas, setAlertas] = useState(alertasIniciales);

  // procesarLotes() es la version pura y probada del FEFO y los filtros (#849). La #840 habia
  // corregido aqui dentro el corte por dia de calendario; esa correccion vive ahora dentro de
  // calcularAlertaDeLote(), que es a quien procesarLotes() se lo pregunta.
  const lotesFiltrados = useMemo(
    () => procesarLotes(lotesIniciales, { busqueda, bodegaSeleccionada, categoriaSeleccionada }),
    [lotesIniciales, busqueda, bodegaSeleccionada, categoriaSeleccionada],
  );

  // Alertas críticas (vencidos o por vencer en <= 30 días)
  const alertasCriticas = useMemo(() => {
    return lotesFiltrados.filter((item) => item.estadoAlerta !== "normal");
  }, [lotesFiltrados]);

  // Aqui estaba validarNuevoLote(), con erroresDeLote/errorValidacion y puedeRegistrarLotes, y el
  // hook devolvia tambien las bodegas y los proveedores que le habian pasado. Todo eso era el
  // modal de "Registrar lote", que se retiro (issue #846). Queda lo que de verdad hace: buscar,
  // filtrar y avisar de lo que esta por vencer.
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
  };
}
