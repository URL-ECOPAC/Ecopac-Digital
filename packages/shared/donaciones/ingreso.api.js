// Vinculo entre una donacion de medicamentos y el ingreso de inventario que genera (issue #192,
// RF-15/RF-27). Sin esto, la donacion se captura dos veces -una vez en donacion_detalle, otra a
// mano en movimientos_inventario- y los numeros dejan de cuadrar.
//
// donacion_detalle no guarda medicamento_id: el renglon nace de una descripcion libre
// ("Paracetamol 500mg x100 tabletas"), no de una fila del catalogo de medicamentos, porque quien
// recibe la donacion no siempre puede identificar el medicamento exacto en el momento. Elegir a
// que medicamento corresponde, en que bodega entra y los datos del lote fisico (numero,
// vencimiento) es una decision de quien genera el ingreso, no algo que se pueda derivar solo del
// renglon -por eso viajan como parametros aparte y no se leen de la donacion.
//
// La cantidad SI viene de donacion_detalle.cantidad: es el dato que ya se capturo al registrar la
// donacion, y repetirlo a mano es justo la duplicacion que esta issue evita.
//
// El candado real contra generar el ingreso dos veces es donacion_detalle.lote_id UNIQUE
// (00022): dos renglones no pueden apuntar al mismo lote. El chequeo de aqui (detalle.lote_id ya
// tiene valor) es la mitad rapida, que evita crear un lote huerfano antes de llegar a esa
// restriccion.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { registrarIngreso } from "../inventario/movimientos.api.js";

/**
 * Genera el movimiento de ingreso de inventario correspondiente a un renglon de una donacion, y
 * enlaza el lote creado de vuelta a ese renglon (donacion_detalle.lote_id).
 *
 * El movimiento queda en el mismo estado pendiente que cualquier otro ingreso: registrarIngreso()
 * no envia estado, lo decide el trigger de la base (issue #192, criterio 2).
 *
 * @param {string} donacionDetalleId
 * @param {{ medicamentoId: string, bodegaId: string, numeroLote: string, fechaVencimiento: string }} datos
 * @returns {Promise<{ datos: { movimiento: object, detalle: object }|null, error: object|null }>}
 */
export async function generarIngresoDesdeDonacion(
  donacionDetalleId,
  { medicamentoId, bodegaId, numeroLote, fechaVencimiento } = {},
) {
  try {
    const supabase = obtenerSupabase();

    const { data: detalle, error: errorDetalle } = await supabase
      .from("donacion_detalle")
      .select("*")
      .eq("id", donacionDetalleId)
      .single();

    if (errorDetalle || !detalle) {
      return { datos: null, error: { mensaje: "El renglon de la donacion no existe." } };
    }

    // Criterio 4: no se puede generar dos veces el ingreso del mismo renglon.
    if (detalle.lote_id) {
      return {
        datos: null,
        error: { mensaje: "Este renglon ya genero su ingreso de inventario." },
      };
    }

    if (!detalle.cantidad || detalle.cantidad <= 0) {
      return {
        datos: null,
        error: {
          mensaje: "El renglon no tiene una cantidad valida para generar el ingreso.",
        },
      };
    }

    const { datos: movimiento, error: errorMovimiento } = await registrarIngreso({
      origen: "donacion",
      bodega_id: bodegaId,
      medicamento_id: medicamentoId,
      numero_lote: numeroLote,
      fecha_vencimiento: fechaVencimiento,
      cantidad: detalle.cantidad,
      motivo: `Donacion: ${detalle.descripcion}`,
    });

    if (errorMovimiento) {
      return { datos: null, error: errorMovimiento };
    }

    // Criterio 3: el lote creado queda enlazado con el renglon que lo origino.
    const { data: detalleEnlazado, error: errorEnlace } = await supabase
      .from("donacion_detalle")
      .update({ lote_id: movimiento.lote_id })
      .eq("id", donacionDetalleId)
      .select()
      .single();

    if (errorEnlace) throw errorEnlace;

    return { datos: { movimiento, detalle: detalleEnlazado }, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Rastrea de que donacion (y de que donante) provino un lote, si de alguna (criterio 5: "desde
 * el lote se puede rastrear de que donacion provino"). Un lote que se compro, no se dono, no
 * tiene ningun donacion_detalle apuntandolo y esta funcion devuelve null sin error.
 *
 * @param {string} loteId
 * @returns {Promise<{ datos: object|null, error: object|null }>}
 */
export async function obtenerDonacionDeLote(loteId) {
  try {
    const supabase = obtenerSupabase();
    const { data, error } = await supabase
      .from("donacion_detalle")
      .select("*, donacion:donaciones(*, donante:donantes(*))")
      .eq("lote_id", loteId)
      .maybeSingle();

    if (error) throw error;
    return { datos: data, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}
