import { useState, useMemo, useCallback } from "react";

import { ORIGENES_DE_LOTE } from "../enums.js";
import { aCadenaFechaLocal, aFechaLocal, diasHastaVencimiento } from "../formato/fechas.js";
import { esAdministrador } from "../usuarios/roles.js";
import { combinarErrores, esTextoVacio, validarConDescriptores } from "../validations/index.js";
import { CAMPOS_LOTE } from "./campos.js";

/**
 * Los valores con que arranca el alta de lote: la fecha de ingreso es hoy, en el dia local.
 *
 * @returns {Record<string, unknown>} Indexado por los ids de CAMPOS_LOTE.
 */
export function valoresInicialesDeLote() {
  return {
    ...Object.fromEntries(CAMPOS_LOTE.map((campo) => [campo.id, ""])),
    origen: ORIGENES_DE_LOTE.COMPRA,
    fechaIngreso: aCadenaFechaLocal(),
  };
}

/**
 * Traduce el formulario de alta de lote a los argumentos que declara registrarLote()
 * (lotes.api.js). El formulario ya usa los ids de CAMPOS_LOTE (issue #840, B1), que son los
 * mismos argumentos: aqui solo se convierten los numeros y se omite lo que quedo vacio. Se
 * exporta aparte del hook para poder probar la traduccion sin montar un componente (issue #709).
 *
 * @param {Record<string, unknown>} valores Indexados por los ids de CAMPOS_LOTE.
 */
export function datosLoteParaRegistrar(valores) {
  const datos = {
    medicamento: valores.medicamento,
    numeroLote: valores.numeroLote,
    proveedor: valores.proveedor,
    origen: valores.origen,
    cantidadIngresada: Number(valores.cantidadIngresada),
    fechaVencimiento: valores.fechaVencimiento,
  };

  // Sin fecha de ingreso la pone la base (DEFAULT CURRENT_DATE, 00020).
  if (!esTextoVacio(valores.fechaIngreso)) datos.fechaIngreso = valores.fechaIngreso;

  // costoUnitario es opcional (issue #752): "" (el campo vacio del formulario) se traduce a
  // ausente, no a NaN ni a 0 -- un costo desconocido no es lo mismo que un costo de cero.
  if (!esTextoVacio(valores.costoUnitario)) datos.costoUnitario = Number(valores.costoUnitario);

  return datos;
}

/**
 * Valida el alta de lote contra CAMPOS_LOTE y los CHECK de la tabla:
 * - fecha_vencimiento >= fecha_ingreso (chk_lotes_vencimiento_posterior, relajado a >= en la 00096:
 *   un lote puede vencer el mismo dia que ingresa)
 * - cantidad_ingresada > 0 (chk_lotes_cantidad_positiva)
 *
 * Hasta la #840 validaba un formulario escrito a mano, con otros nombres de campo, que exigia una
 * bodega que registrarLote() nunca guardaba y seguia con la regla estricta anterior a la 00096.
 *
 * @param {Record<string, unknown>} valores Indexados por los ids de CAMPOS_LOTE.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarDatosDeLote(valores = {}) {
  const propias = {};

  if (!esTextoVacio(valores.cantidadIngresada) && !(Number(valores.cantidadIngresada) > 0)) {
    propias.cantidadIngresada = "La cantidad ingresada debe ser mayor a 0.";
  }

  const ingreso = aFechaLocal(
    esTextoVacio(valores.fechaIngreso) ? aCadenaFechaLocal() : valores.fechaIngreso,
  );
  const vencimiento = aFechaLocal(valores.fechaVencimiento);
  if (ingreso && vencimiento && vencimiento < ingreso) {
    propias.fechaVencimiento = "La fecha de vencimiento no puede ser anterior a la de ingreso.";
  }

  return combinarErrores(validarConDescriptores(CAMPOS_LOTE, valores), propias);
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
  const [erroresDeLote, setErroresDeLote] = useState({});

  // Regla de Permisos: Solo el Administrador puede registrar lotes.
  //
  // issue #689: comparaba usuario?.rol contra el literal "Administrador", con mayuscula. El
  // enum rol_usuario (00001) y usuarios/roles.js lo declaran en minuscula
  // ("administrador"), asi que esa comparacion nunca coincidia -- mismo defecto que la propia
  // InventarioPage.jsx, que es quien llama a este hook.
  const puedeRegistrarLotes = esAdministrador(usuario?.rol);

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

  const validarNuevoLote = useCallback((valores) => {
    const errores = validarDatosDeLote(valores);
    const hayErrores = Object.keys(errores).length > 0;
    setErroresDeLote(errores);
    setErrorValidacion(hayErrores ? "Revisa los campos marcados." : null);
    return !hayErrores;
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
    erroresDeLote,
  };
}
