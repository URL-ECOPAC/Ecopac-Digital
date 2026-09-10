import { useCallback, useEffect, useState } from "react";

import { obtenerRecetaPorAtencion } from "./entrega.api.js";
import { diasHastaVencimiento } from "../formato/fechas.js";

/**
 * Anota dias restantes y vencido en un detalle, con diasHastaVencimiento() (formato/fechas.js):
 * negativo si ya vencio, 0 si vence hoy (todavia entregable, no vencido), null sin fecha valida.
 */
function conVencimiento(detalle) {
  const diasRestantes = diasHastaVencimiento(detalle.fechaVencimiento);
  return {
    ...detalle,
    diasRestantes,
    vencido: diasRestantes !== null && diasRestantes < 0,
  };
}

/**
 * View model de la pantalla de entrega de medicamentos (issue #749): la receta emitida de una
 * atencion, con su detalle listo para mostrar.
 *
 * Es de solo lectura: el descuento de inventario de una receta con lote ya ocurre al generarla
 * (fn_generar_receta, migracion 00112), no aqui. No hay todavia un mecanismo de "confirmar
 * entrega" en la base de datos para los renglones sin lote; construirlo es otra issue.
 *
 * @param {string} atencionId
 */
export function useEntregaMedicamentos(atencionId) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [receta, setReceta] = useState(null);
  const [detalles, setDetalles] = useState([]);

  const recargar = useCallback(async () => {
    if (!atencionId) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await obtenerRecetaPorAtencion(atencionId);

    if (respuesta.error) {
      setError(respuesta.error);
      setReceta(null);
      setDetalles([]);
      setCargando(false);
      return;
    }

    setReceta(respuesta.receta);
    setDetalles(respuesta.detalles.map(conVencimiento));
    setCargando(false);
  }, [atencionId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { cargando, error, receta, detalles, recargar };
}
