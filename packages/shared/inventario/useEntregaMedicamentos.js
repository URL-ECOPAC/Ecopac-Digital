import { useCallback, useEffect, useState } from "react";

import { ajustarEntregaReceta, obtenerRecetaPorAtencion } from "./entrega.api.js";
import { diasHastaVencimiento } from "../formato/fechas.js";

/**
 * Anota dias restantes y vencido en un detalle, con diasHastaVencimiento() (formato/fechas.js):
 * negativo si ya vencio, 0 si vence hoy (todavia entregable, no vencido), null sin fecha valida.
 * Tambien anota cantidadRealEntregada (issue #764): cantidadAjustada si alguien ya corrigio este
 * renglon con fn_ajustar_entrega_receta(), si no cantidadEntregada -la cifra original de la
 * receta-. Quien pinte esta pantalla debe mostrar y editar cantidadRealEntregada, nunca
 * cantidadEntregada directamente: esa columna no se reescribe (ver 00125).
 */
function conVencimiento(detalle) {
  const diasRestantes = diasHastaVencimiento(detalle.fechaVencimiento);
  return {
    ...detalle,
    diasRestantes,
    vencido: diasRestantes !== null && diasRestantes < 0,
    cantidadRealEntregada: detalle.cantidadAjustada ?? detalle.cantidadEntregada,
  };
}

/**
 * View model de la pantalla de entrega de medicamentos (issue #749, extendida por la #764): la
 * receta emitida de una atencion, con su detalle listo para mostrar, y ajustarEntrega() para
 * corregir la cantidad realmente entregada de un renglon.
 *
 * El descuento de inventario de una receta con lote ya ocurre al generarla (fn_generar_receta,
 * migracion 00112); ajustarEntrega() nunca reaplica esa cantidad completa, solo la diferencia
 * contra el ultimo valor confirmado (fn_ajustar_entrega_receta, migracion 00125), asi que no hay
 * riesgo de descontar dos veces. Los renglones sin lote no se pueden ajustar por inventario (no
 * hay bodega de la que corregir): fn_ajustar_entrega_receta() rechaza ese caso, y quien llame a
 * ajustarEntrega() con uno de esos renglones recibe ese mismo error.
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

  /**
   * Confirma la cantidad realmente entregada de un renglon. Relanza el error (no lo traga) para
   * que quien la llame decida como mostrarlo junto al campo que se esta editando, en vez de
   * perder ese contexto detras de un ErrorState de pantalla completa; si sale bien, recarga para
   * traer cantidadAjustada/ajustadaPor/ajustadaEn ya actualizados desde la base.
   *
   * @param {string} recetaDetalleId
   * @param {number} cantidadReal
   */
  const ajustarEntrega = useCallback(
    async (recetaDetalleId, cantidadReal) => {
      const { error: errorAjuste } = await ajustarEntregaReceta(recetaDetalleId, cantidadReal);
      if (errorAjuste) {
        throw new Error(errorAjuste.mensaje);
      }
      await recargar();
    },
    [recargar],
  );

  return { cargando, error, receta, detalles, recargar, ajustarEntrega };
}
