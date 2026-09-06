import { useEffect, useState } from "react";

import { consultarLotesDisponibles } from "./existencias.api.js";
import { registrarSalida } from "./movimientos.api.js";

/**
 * Hook del formulario de salida de medicamentos (issue #690).
 *
 * QUE ESTABA MAL. Recibia `supabase` por parametro (`useRegistroSalida({ supabase, onExito })`)
 * en vez de obtenerlo con obtenerSupabase() como el resto del paquete; ninguna app puede
 * importar @supabase/supabase-js para dárselo (docs/ARQUITECTURA-FRONTEND.md), y
 * ModalSalidaMedicamento.jsx nunca lo pasaba, asi que `supabase` llegaba `undefined` y elegir un
 * medicamento tiraba un TypeError que el catch convertia en "Error al cargar los lotes
 * disponibles.", sin apuntar a la causa real.
 *
 * Ademas la consulta pedia `lotes.cantidad_ingresada` -lo que entro al lote, migracion 00020- y
 * lo mostraba como si fuera el stock. El stock vivo esta en existencias.cantidad_disponible,
 * particionado por (lote_id, bodega_id) desde la 00047, y la consulta tampoco filtraba vencidos
 * ni bodega.
 *
 * Y guardarSalida() armaba el payload y se lo pasaba tal cual a onExito(): no habia ningun await
 * a una API en todo el archivo. registrarSalida() (movimientos.api.js) existia y no la llamaba
 * nadie desde aqui.
 *
 * QUE HACE AHORA. consultarLotesDisponibles() (existencias.api.js) ya consulta
 * vista_lotes_disponibles, que excluye lo vencido y lo que esta en cero (00047), y devuelve un
 * lote por cada (lote, bodega) con existencia real -asi que el desplegable ya distingue bodega
 * sin necesitar un selector aparte-. guardarSalida() llama a registrarSalida() de verdad.
 *
 * FEFO SIN sugerirLote(). consultarLotesDisponibles() ya ordena por fecha_vencimiento ascendente,
 * y esta pantalla elige UN lote y UNA cantidad, no reparte entre varios: sugerir el primero de
 * la lista ya es FEFO. sugerirLote() (lotes.validaciones.js) sirve para repartir una cantidad
 * entre varios lotes, que no es este caso, y ademas tiene su propia definicion de "vencido"
 * distinta de la que ya aplica la vista (issue #694): usarla aqui duplicaria el filtro con un
 * criterio que puede no coincidir con el que ya trae la lista.
 *
 * @param {{ usuarioId?: string, onExito?: (datos: object) => void }} [opciones]
 */
export function useRegistroSalida({ usuarioId, onExito } = {}) {
  const [motivo, setMotivo] = useState("");
  const [medicamentoId, setMedicamentoId] = useState("");
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vigente = true;

    if (!medicamentoId) {
      setLotesDisponibles([]);
      setLoteSeleccionado(null);
      return () => {
        vigente = false;
      };
    }

    setCargando(true);
    setError(null);

    consultarLotesDisponibles(medicamentoId).then(({ lotes, error: fallo }) => {
      if (!vigente) return;

      if (fallo) {
        setError(fallo.mensaje || "Error al cargar los lotes disponibles.");
        setLotesDisponibles([]);
        setLoteSeleccionado(null);
      } else {
        setLotesDisponibles(lotes);
        // El primero de la lista es el de vencimiento mas proximo (FEFO): ver nota de cabecera
        // sobre por que no hace falta sugerirLote() para esto.
        setLoteSeleccionado(lotes[0] ?? null);
      }
      setCargando(false);
    });

    return () => {
      vigente = false;
    };
  }, [medicamentoId]);

  const seleccionarLote = (lote) => {
    setError(null);
    setLoteSeleccionado(lote);
  };

  const guardarSalida = async (e) => {
    e.preventDefault();
    setError(null);

    if (!loteSeleccionado) {
      setError("Debe seleccionar un lote válido.");
      return;
    }

    if (Number(cantidad) > loteSeleccionado.cantidadDisponible) {
      setError(
        `La cantidad solicitada supera la existencia disponible del lote (${loteSeleccionado.cantidadDisponible} unidades).`,
      );
      return;
    }

    setCargando(true);

    const { datos, error: fallo } = await registrarSalida({
      bodega_id: loteSeleccionado.bodegaId,
      lote_id: loteSeleccionado.loteId,
      cantidad: Number(cantidad),
      motivo,
      usuarioId,
    });

    setCargando(false);

    if (fallo) {
      setError(fallo.mensaje);
      return;
    }

    if (onExito) onExito(datos);
  };

  return {
    motivo,
    setMotivo,
    medicamentoId,
    setMedicamentoId,
    loteSeleccionado,
    seleccionarLote,
    cantidad,
    setCantidad,
    lotesDisponibles,
    error,
    cargando,
    guardarSalida,
  };
}
