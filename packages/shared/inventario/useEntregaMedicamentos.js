import { useCallback, useState } from "react";

import { cerrarAtencion } from "../atenciones/api.js";
import { obtenerDetalleDeEntrega } from "./entrega.api.js";
import { motivoSinDisponibilidad } from "./existencias.validaciones.js";

/**
 * Hook de la pantalla de entrega de medicamentos en campo (issue #164 / #759).
 *
 * La consulta y la traduccion de columnas viven en entrega.api.js, no aqui: este hook solo
 * orquesta el estado de carga, la cantidad que cada renglon lleva escrita en pantalla y la
 * confirmacion final. Ver la cabecera de obtenerDetalleDeEntrega() para el detalle de que
 * estaba mal en la version anterior (columnas inexistentes, PGRST108, { data, err } en vez de
 * { data, error }, y una interfaz que no coincidia con la que EntregaMedicamentosScreen.js
 * espera).
 *
 * QUE SIGUE PENDIENTE, A PROPOSITO. La issue #164 (RF-20) pedia que la cantidad realmente
 * entregada -que puede ser menor a la recetada- quedara registrada como su propio movimiento
 * de salida. Eso ya no encaja con la arquitectura actual: fn_generar_receta (00112, issue
 * #711) crea la salida de forma atomica en el momento de generar la receta, con la cantidad
 * recetada, precisamente para que una receta emitida nunca quede sin su descuento de
 * inventario. Hoy no existe ninguna funcion para revisar esa cantidad despues, y registrar
 * una segunda salida aqui descontaria el inventario dos veces por el mismo renglon. Mientras
 * esa decision de arquitectura no se tome, confirmarEntrega() cierra la atencion -una accion
 * real, ya soportada- y no reescribe cantidad_entregada.
 *
 * @param {{ atencionId?: string }} [opciones]
 */
export function useEntregaMedicamentos({ atencionId } = {}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [receta, setReceta] = useState([]);
  const [entrega, setEntrega] = useState({});

  const cargarReceta = useCallback(async () => {
    if (!atencionId) return;

    setCargando(true);
    setError(null);

    const { detalle, error: fallo } = await obtenerDetalleDeEntrega(atencionId);

    if (fallo) {
      setError(fallo.mensaje);
      setReceta([]);
    } else {
      setReceta(detalle);
      setEntrega(
        Object.fromEntries(detalle.map((renglon) => [renglon.id, renglon.cantidad_recetada])),
      );
    }

    setCargando(false);
  }, [atencionId]);

  const registrarCantidad = useCallback((detalleId, cantidad) => {
    setEntrega((previo) => ({ ...previo, [detalleId]: cantidad }));
  }, []);

  /** @returns {string[]} Los motivos por los que esta cantidad no se puede entregar, o []. */
  const validarEntrega = useCallback((detalle, cantidad, existenciasDisponibles) => {
    if (!detalle) return [];

    const motivo = motivoSinDisponibilidad({
      lote: { fechaVencimiento: detalle.fechaVencimiento },
      cantidadDisponible: existenciasDisponibles ?? detalle.existencias,
      cantidadSolicitada: cantidad,
    });

    return motivo ? [motivo] : [];
  }, []);

  const confirmarEntrega = useCallback(async () => {
    const { error: fallo } = await cerrarAtencion(atencionId, "Entrega de medicamentos completada");

    if (fallo) {
      setError(fallo.mensaje);
      return { exito: false };
    }

    return { exito: true };
  }, [atencionId]);

  return {
    cargando,
    error,
    receta,
    entrega,
    cargarReceta,
    registrarCantidad,
    confirmarEntrega,
    validarEntrega,
  };
}
