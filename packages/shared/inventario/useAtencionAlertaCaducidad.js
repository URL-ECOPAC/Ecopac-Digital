import { useCallback, useMemo, useRef, useState } from "react";

import {
  accionesPermitidasParaAlerta,
  efectoDeAccionSobreElStock,
  requiereBodegaDestino,
} from "./alertas.api.js";
import { OPCIONES_ACCION_ALERTA } from "./campos.js";

/**
 * Formulario de "Registrar acción tomada" sobre una alerta de vencimiento (issue #899).
 *
 * Una alerta se reparte en una o mas acciones -parte donada, parte descartada- cuyas cantidades
 * tienen que sumar exacto lo que queda HOY en el lote (cantidadDisponible, issue #859), la misma
 * regla que valida fn_atender_alerta_caducidad (00143). Este estado vivia dentro del panel web y
 * se perdio con el (PR #881); ahora vive aqui para que la pantalla solo lo dibuje.
 *
 * @param {{ marcarComoAtendida: (id: string, acciones: object[], total: number) => Promise<unknown>,
 *   bodegas?: {id: string, nombre: string}[] }} opciones `marcarComoAtendida` es la de
 *   useAlertasVencimiento(): lanza con el mensaje del servidor si falla.
 * @returns {object} Con: alerta, abrir, cerrar, acciones, accionActual, setAccionActual,
 *   cantidadActual, setCantidadActual, bodegaDestinoActual, setBodegaDestinoActual,
 *   opcionesAccion, opcionesBodega, pideBodega, efecto, totalDisponible, restante,
 *   agregarDeshabilitado, agregar, quitar, errorRenglon, errorAtender, confirmando,
 *   confirmarDeshabilitado, confirmar.
 */
export function useAtencionAlertaCaducidad({ marcarComoAtendida, bodegas = [] } = {}) {
  const [alerta, setAlerta] = useState(null);
  const [acciones, setAcciones] = useState([]);
  const [accionActual, setAccionActualInterna] = useState("");
  const [cantidadActual, setCantidadActual] = useState(null);
  const [bodegaDestinoActual, setBodegaDestinoActual] = useState("");
  const [errorRenglon, setErrorRenglon] = useState(null);
  const [errorAtender, setErrorAtender] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const siguienteId = useRef(1);

  const limpiarRenglon = useCallback(() => {
    setAccionActualInterna("");
    setCantidadActual(null);
    setBodegaDestinoActual("");
    setErrorRenglon(null);
  }, []);

  const abrir = useCallback(
    (nueva) => {
      setAlerta(nueva);
      setAcciones([]);
      limpiarRenglon();
      setErrorAtender(null);
    },
    [limpiarRenglon],
  );

  const cerrar = useCallback(() => {
    setAlerta(null);
    setAcciones([]);
    setErrorAtender(null);
  }, []);

  // Cambiar de accion descarta la bodega elegida: solo "reubicado" la usa.
  const setAccionActual = useCallback((valor) => {
    setAccionActualInterna(valor ?? "");
    setBodegaDestinoActual("");
  }, []);

  const totalDisponible = alerta?.cantidadDisponible ?? 0;
  const asignado = acciones.reduce((total, item) => total + item.cantidad, 0);
  const restante = totalDisponible - asignado;
  const pideBodega = requiereBodegaDestino(accionActual);

  const opcionesAccion = useMemo(
    () => accionesPermitidasParaAlerta(alerta, OPCIONES_ACCION_ALERTA),
    [alerta],
  );
  const opcionesBodega = useMemo(
    () => bodegas.map((bodega) => ({ value: bodega.id, label: bodega.nombre })),
    [bodegas],
  );

  const agregarDeshabilitado =
    !accionActual ||
    !(cantidadActual > 0) ||
    cantidadActual > restante ||
    (pideBodega && !bodegaDestinoActual);

  const agregar = useCallback(() => {
    setErrorRenglon(null);

    if (!accionActual) {
      setErrorRenglon("Selecciona una acción.");
      return;
    }
    if (!(cantidadActual > 0)) {
      setErrorRenglon("La cantidad debe ser mayor a cero.");
      return;
    }
    if (cantidadActual > restante) {
      setErrorRenglon(`No puedes asignar más de lo que falta (${restante}).`);
      return;
    }
    if (pideBodega && !bodegaDestinoActual) {
      setErrorRenglon("Para reubicar hay que elegir la bodega destino.");
      return;
    }

    const id = siguienteId.current;
    siguienteId.current += 1;
    setAcciones((anteriores) => [
      ...anteriores,
      {
        id,
        accion: accionActual,
        cantidad: cantidadActual,
        bodegaDestinoId: pideBodega ? bodegaDestinoActual : undefined,
      },
    ]);
    limpiarRenglon();
  }, [accionActual, bodegaDestinoActual, cantidadActual, limpiarRenglon, pideBodega, restante]);

  const quitar = useCallback((id) => {
    setAcciones((anteriores) => anteriores.filter((item) => item.id !== id));
  }, []);

  const confirmar = useCallback(async () => {
    if (!alerta || restante !== 0 || acciones.length === 0) return false;
    setErrorAtender(null);
    setConfirmando(true);
    try {
      await marcarComoAtendida(alerta.id, acciones, totalDisponible);
      setConfirmando(false);
      cerrar();
      return true;
    } catch (error) {
      setErrorAtender(error.message || "No se pudo registrar la acción.");
      setConfirmando(false);
      return false;
    }
  }, [acciones, alerta, cerrar, marcarComoAtendida, restante, totalDisponible]);

  return {
    alerta,
    abrir,
    cerrar,
    acciones,
    accionActual,
    setAccionActual,
    cantidadActual,
    setCantidadActual,
    bodegaDestinoActual,
    setBodegaDestinoActual,
    opcionesAccion,
    opcionesBodega,
    pideBodega,
    efecto:
      accionActual && cantidadActual > 0
        ? efectoDeAccionSobreElStock(accionActual, cantidadActual)
        : null,
    totalDisponible,
    restante,
    textoRestante:
      restante > 0
        ? `Faltan ${restante} de ${totalDisponible} unidades por asignar.`
        : "Todas las unidades quedaron asignadas.",
    agregarDeshabilitado,
    agregar,
    quitar,
    errorRenglon,
    errorAtender,
    confirmando,
    confirmarDeshabilitado: restante !== 0 || acciones.length === 0 || confirmando,
    confirmar,
  };
}
