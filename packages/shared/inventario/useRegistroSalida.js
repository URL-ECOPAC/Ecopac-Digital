import { useEffect, useState } from "react";

import { consultarLotesDisponibles } from "./existencias.api.js";
import { registrarSalida } from "./movimientos.api.js";
import { recargarAlertasMontadas } from "./useAlertasVencimiento.js";

/**
 * Identifica un lote del desplegable. Un mismo lote puede estar en dos bodegas (existencias se
 * parte por lote y bodega desde la 00047), asi que el id del lote solo no alcanza: con el, dos
 * opciones compartian `value` y elegir la segunda seleccionaba la primera.
 *
 * @param {{ loteId: string, bodegaId?: string|null }} lote
 * @returns {string}
 */
export function claveDeLoteDeSalida(lote) {
  return lote ? `${lote.loteId}|${lote.bodegaId ?? ""}` : "";
}

/**
 * Que impide registrar la salida, en el orden en que la persona llena el formulario. Pura y
 * exportada para probarla sin montar el hook (issue #911).
 *
 * Existe para que la pantalla deshabilite "Registrar salida" y diga por que, en vez de dejar que el
 * navegador muestre "Please select an item in the list" o que el servidor rechace una cantidad que
 * no hay.
 *
 * @param {{ motivo?: string, medicamentoId?: string, loteSeleccionado?: object|null,
 *   cantidad?: string|number, lotesDisponibles?: object[], cargando?: boolean }} estado
 * @returns {{ sinExistencia: boolean, avisoCantidad: string|null, puedeGuardar: boolean }}
 */
export function estadoDeLaSalida({
  motivo,
  medicamentoId,
  loteSeleccionado,
  cantidad,
  lotesDisponibles = [],
  cargando = false,
} = {}) {
  const sinExistencia = Boolean(medicamentoId) && !cargando && lotesDisponibles.length === 0;
  const pedida = Number(cantidad);
  const disponible = Number(loteSeleccionado?.cantidadDisponible ?? 0);

  let avisoCantidad = null;
  if (loteSeleccionado && cantidad !== "" && cantidad !== undefined && pedida > disponible) {
    avisoCantidad = `No hay existencia suficiente: el lote tiene ${disponible} disponibles.`;
  }

  const puedeGuardar =
    !cargando &&
    Boolean(motivo) &&
    Boolean(loteSeleccionado) &&
    pedida > 0 &&
    Number.isInteger(pedida) &&
    avisoCantidad === null;

  return { sinExistencia, avisoCantidad, puedeGuardar };
}

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
 * SIN EXISTENCIA (issue #911). `sinExistencia`, `avisoCantidad` y `puedeGuardar` (estadoDeLaSalida)
 * dejan a la pantalla deshabilitar "Registrar salida" y decir que no hay existencia, en vez de
 * habilitar el boton y que lo frene el aviso del navegador.
 *
 * @param {{ usuarioId?: string, onExito?: (datos: object) => void }} [opciones]
 * @returns {object} Con: motivo, setMotivo, medicamentoId, setMedicamentoId, loteSeleccionado, seleccionarLote, seleccionarLotePorClave, claveLoteSeleccionado, cantidad, setCantidad, lotesDisponibles, sinExistencia, avisoCantidad, puedeGuardar, error, cargando, guardarSalida.
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

  /** Elige el lote por la clave de su opcion (claveDeLoteDeSalida). */
  const seleccionarLotePorClave = (clave) => {
    const lote = lotesDisponibles.find((opcion) => claveDeLoteDeSalida(opcion) === clave);
    if (lote) seleccionarLote(lote);
  };

  const { sinExistencia, avisoCantidad, puedeGuardar } = estadoDeLaSalida({
    motivo,
    medicamentoId,
    loteSeleccionado,
    cantidad,
    lotesDisponibles,
    cargando,
  });

  const guardarSalida = async (e) => {
    e?.preventDefault?.();
    setError(null);

    if (!motivo) {
      setError("Elige el motivo de la salida.");
      return;
    }

    if (!loteSeleccionado) {
      setError(
        sinExistencia
          ? "No hay existencia de este medicamento para registrar la salida."
          : "Debe seleccionar un lote válido.",
      );
      return;
    }

    if (avisoCantidad) {
      setError(avisoCantidad);
      return;
    }

    if (!puedeGuardar) {
      setError("La cantidad a retirar debe ser un número entero mayor que cero.");
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

    // No se espera: es un refresco de cortesia para quien tenga el panel de alertas abierto en
    // otra pestana, no algo de lo que dependa el resto de este flujo. recargarAlertasMontadas()
    // nunca rechaza -las funciones que consulta ya atrapan su propio error-, asi que no hay nada
    // que capturar aqui.
    recargarAlertasMontadas();

    if (onExito) onExito(datos);
  };

  return {
    motivo,
    setMotivo,
    medicamentoId,
    setMedicamentoId,
    loteSeleccionado,
    seleccionarLote,
    seleccionarLotePorClave,
    claveLoteSeleccionado: claveDeLoteDeSalida(loteSeleccionado),
    cantidad,
    setCantidad,
    lotesDisponibles,
    sinExistencia,
    avisoCantidad,
    puedeGuardar,
    error,
    cargando,
    guardarSalida,
  };
}
