import { useState } from "react";

import { registrarIngreso } from "./movimientos.api.js";
import { registrarMedicamento } from "./medicamentos.api.js";
import { puedeAdministrarMedicamentos } from "./medicamentos.permisos.js";

const ITEM_VACIO = {
  medicamento_id: "",
  numero_lote: "",
  fecha_vencimiento: "",
  cantidad: "",
  bodega_id: "",
};

/**
 * Item de arranque para un renglon de donacion pendiente de convertirse en ingreso (issue #756):
 * la cantidad viene ya capturada en donacion_detalle.cantidad, y medicamentoId si la persona ya
 * lo habia escrito al registrar la donacion (no es obligatorio ahi). El resto -bodega, lote,
 * vencimiento- lo completa quien genera el ingreso, igual que cualquier otro item de esta lista.
 *
 * `donacionDetalleId` viaja en el item solo para que quien use este hook pueda correlacionar
 * cada movimiento creado con el renglon que lo origino (por ejemplo, para enlazar el lote de
 * vuelta con donacion_detalle.lote_id, donaciones/ingreso.api.js): datosIngresoParaRegistrar()
 * no lo lee, asi que nunca llega al servidor.
 */
export function itemDesdeRenglonDeDonacion(renglon) {
  return {
    ...ITEM_VACIO,
    medicamento_id: renglon?.medicamentoId || "",
    cantidad: renglon?.cantidad ?? "",
    donacionDetalleId: renglon?.donacionDetalleId ?? null,
  };
}

/**
 * Traduce un item de la lista del formulario mas los datos comunes del ingreso (origen,
 * proveedor, comprobante, usuario) a los argumentos que declara registrarIngreso()
 * (movimientos.api.js). Se exporta aparte del hook para poder probar la traduccion sin montar
 * un componente (issue #709).
 *
 * @param {object} item
 * @param {{ origen: string, proveedorId: string, numeroComprobante: string, usuarioId?: string }} datosComunes
 */
export function datosIngresoParaRegistrar(
  item,
  { origen, proveedorId, numeroComprobante, usuarioId },
) {
  return {
    origen,
    bodega_id: item.bodega_id,
    medicamento_id: item.medicamento_id,
    numero_lote: item.numero_lote,
    fecha_vencimiento: item.fecha_vencimiento,
    proveedor_id: proveedorId,
    cantidad: item.cantidad,
    motivo: numeroComprobante.trim() || undefined,
    usuarioId,
  };
}

/**
 * Hook del formulario de registro de ingreso de medicamentos (issue #709).
 *
 * QUE ESTABA MAL. guardarMovimiento() armaba un objeto de mentira -id "ING-<timestamp>" (no un
 * UUID), estado "PENDIENTE" (el enum estado_movimiento es 'pendiente', en minuscula, y ademas
 * el estado lo decide el trigger de la base, no el cliente)- y lo pasaba tal cual a
 * onGuardarExitoso(): no habia ningun await a una API en todo el archivo. registrarIngreso()
 * (movimientos.api.js) existia, estaba probada, y no la llamaba nadie desde aqui. Ademas
 * guardarMovimiento() no devolvia nada, asi que ModalRegistroIngreso.jsx comprobaba
 * `const exito = await guardarMovimiento(...); if (exito ...)` contra un `undefined` que nunca
 * iba a ser verdadero.
 *
 * QUE HACE AHORA. Cada medicamento agregado a la lista es su propio lote (numero_lote y
 * fecha_vencimiento propios), asi que se registra con una llamada a registrarIngreso() por
 * item -la misma primitiva ya usada por el resto del modulo-, deteniendose en el primer error en
 * vez de seguir intentando a ciegas. `origen` (compra/donacion) y `proveedorId` viajan igual
 * para los dos: un donante registrado como proveedor de tipo 'donante' (proveedores.tipo,
 * 00017) es tan valido como uno comercial para registrarIngreso(), que exige proveedor_id sin
 * distinguir el origen. `registrarIngreso()` no sabe nada de `donacion_detalle` -crea el
 * movimiento y el lote, nada mas-; enlazar el lote de vuelta al renglon que lo origino
 * (issue #756) es cosa de `detallesDonacion` mas abajo, no de este bloque.
 *
 * `rol` (issue #165, criterio 1) habilita `puedeCrearMedicamento` y `crearMedicamentoNuevo()`.
 * Es opcional y no cambia nada de lo que ya usa #156: sin `rol`, `puedeCrearMedicamento` da
 * `false` (mismo resultado que `puedeAdministrarMedicamentos(undefined)`) y las dos funciones
 * nuevas simplemente quedan sin usar.
 *
 * `detallesDonacion` (issue #756) precarga un renglon de donacion a la vez en `itemActual`
 * -cantidad, y medicamento si ya se habia escrito- cada vez que `agregarItem()` guarda el
 * anterior, en vez de dejarlo en blanco: la persona sigue completando bodega/lote/vencimiento y
 * pulsando "+ Añadir" como con cualquier otro item, sin volver a escribir la cantidad. `origen`
 * arranca en 'donacion' cuando hay renglones que precargar. Cada item guarda su
 * `donacionDetalleId` para que quien llame a este hook pueda enlazar el lote creado de vuelta al
 * renglon (`enlazarLoteConDonacion()`, donaciones/ingreso.api.js) usando los `movimientos` y los
 * `items` que entrega `onGuardarExitoso` en el mismo orden -esa llamada vive fuera de este
 * archivo a proposito: packages/shared/inventario/ no conoce donacion_detalle.
 *
 * `proveedorIdInicial` (issue #756) precarga el proveedor -tipico cuando ya se sabe cual es,
 * como el sugerido por `sugerirProveedorId()` a partir del donante de la donacion- sin quitarle
 * a la persona la posibilidad de cambiarlo antes de guardar.
 *
 * @param {{ usuarioId?: string, rol?: string,
 *   onGuardarExitoso?: (movimientos: object[], items: object[]) => void,
 *   detallesDonacion?: { donacionDetalleId: string, cantidad: number, medicamentoId?: string,
 *     descripcion?: string }[], proveedorIdInicial?: string }} [opciones]
 */
export function useRegistroIngreso({
  usuarioId,
  rol,
  onGuardarExitoso,
  detallesDonacion = [],
  proveedorIdInicial = "",
} = {}) {
  const [origen, setOrigenState] = useState(detallesDonacion.length > 0 ? "donacion" : "compra");
  const [proveedorId, setProveedorId] = useState(proveedorIdInicial);
  const [numeroComprobante, setNumeroComprobante] = useState("");

  const [indiceRenglonDonacion, setIndiceRenglonDonacion] = useState(0);
  const [items, setItems] = useState([]);
  const [itemActual, setItemActual] = useState(() =>
    detallesDonacion.length > 0 ? itemDesdeRenglonDeDonacion(detallesDonacion[0]) : ITEM_VACIO,
  );

  const [resumenGuardado, setResumenGuardado] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [creandoMedicamento, setCreandoMedicamento] = useState(false);
  const [errorMedicamento, setErrorMedicamento] = useState(null);

  const setOrigen = (nuevoOrigen) => {
    setOrigenState(nuevoOrigen);
    setError(null);
  };

  const agregarItem = () => {
    if (
      !itemActual.medicamento_id ||
      !itemActual.numero_lote ||
      !itemActual.cantidad ||
      !itemActual.bodega_id
    ) {
      setError(
        "Completa los campos obligatorios del medicamento (Medicamento, Lote, Cantidad y Bodega).",
      );
      return;
    }

    if (Number(itemActual.cantidad) <= 0) {
      setError("La cantidad ingresada debe ser mayor a 0.");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        ...itemActual,
        cantidad: Number(itemActual.cantidad),
        id: Date.now(),
      },
    ]);

    // Con renglones de donacion pendientes, el siguiente reemplaza al vacio de siempre: es lo
    // que deja a la persona seguir sin volver a escribir la cantidad de cada renglon.
    const siguienteIndice = indiceRenglonDonacion + 1;
    setItemActual(
      siguienteIndice < detallesDonacion.length
        ? itemDesdeRenglonDeDonacion(detallesDonacion[siguienteIndice])
        : ITEM_VACIO,
    );
    setIndiceRenglonDonacion(siguienteIndice);
    setError(null);
  };

  const eliminarItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  /** @returns {Promise<boolean>} Si el ingreso completo (todos sus items) se registro sin error. */
  const guardarMovimiento = async () => {
    if (items.length === 0) {
      setError("Debes agregar al menos un medicamento al ingreso.");
      return false;
    }

    if (!proveedorId) {
      setError("Debes seleccionar el proveedor o donante de procedencia.");
      return false;
    }

    setGuardando(true);
    setError(null);

    const movimientos = [];
    let fallo = null;

    for (const item of items) {
      const resultado = await registrarIngreso(
        datosIngresoParaRegistrar(item, { origen, proveedorId, numeroComprobante, usuarioId }),
      );

      if (resultado.error) {
        fallo = resultado.error;
        break;
      }
      movimientos.push(resultado.datos);
    }

    setGuardando(false);

    if (fallo) {
      setError(fallo.mensaje);
      return false;
    }

    setResumenGuardado({ origen, proveedorId, numeroComprobante, movimientos });
    // `items` va en el mismo orden que `movimientos` -el for de arriba empuja uno por otro sin
    // reordenar-, asi que quien reciba los dos puede correlacionar movimientos[i] con
    // items[i].donacionDetalleId sin adivinar.
    if (onGuardarExitoso) onGuardarExitoso(movimientos, items);
    return true;
  };

  const resetFormulario = () => {
    setOrigenState(detallesDonacion.length > 0 ? "donacion" : "compra");
    setProveedorId(proveedorIdInicial);
    setNumeroComprobante("");
    setItems([]);
    setIndiceRenglonDonacion(0);
    setItemActual(
      detallesDonacion.length > 0 ? itemDesdeRenglonDeDonacion(detallesDonacion[0]) : ITEM_VACIO,
    );
    setResumenGuardado(null);
    setError(null);
  };

  /**
   * Puede registrar un medicamento nuevo en el catalogo (issue #165, criterio 1).
   *
   * Espejo de `puedeAdministrarMedicamentos(rol)` (medicamentos.permisos.js): la politica de
   * INSERT de `medicamentos` (00034) exige `es_administrador()`, y `fn_registrar_medicamento`
   * (00050) NO es SECURITY DEFINER, asi que corre con esos mismos privilegios. Este valor solo
   * decide que dibuja la pantalla -un medico o voluntario en campo elige entre los medicamentos
   * existentes, o da de alta un lote nuevo de uno ya catalogado (00107)-, nunca reemplaza esa
   * politica: un intento igual sin permiso vuelve como 42501 desde registrarMedicamento().
   */
  const puedeCrearMedicamento = puedeAdministrarMedicamentos(rol);

  /**
   * Registra un medicamento nuevo en el catalogo y lo deja elegido en `itemActual.medicamento_id`
   * (issue #165, criterio 1). Delega en `registrarMedicamento()` (medicamentos.api.js), que ya
   * valida `principiosActivosIds` y traduce cualquier error del servidor -incluido el 42501 de
   * quien no es administrador- a un mensaje apto para pantalla.
   *
   * No toca `items` ni `guardarMovimiento()`: solo prepara el medicamento que el resto del
   * formulario ya sabe usar.
   *
   * @param {object} datos Mismos campos que `registrarMedicamento()` (medicamentos.api.js).
   * @returns {Promise<{ medicamento: object|null, error: object|null }>}
   */
  const crearMedicamentoNuevo = async (datos) => {
    setCreandoMedicamento(true);
    setErrorMedicamento(null);

    const resultado = await registrarMedicamento(datos);

    setCreandoMedicamento(false);

    if (resultado.error) {
      setErrorMedicamento(resultado.error.mensaje);
      return resultado;
    }

    setItemActual((prev) => ({ ...prev, medicamento_id: resultado.medicamento.id }));
    return resultado;
  };

  return {
    origen,
    setOrigen,
    proveedorId,
    setProveedorId,
    numeroComprobante,
    setNumeroComprobante,
    items,
    itemActual,
    setItemActual,
    agregarItem,
    eliminarItem,
    guardarMovimiento,
    resumenGuardado,
    resetFormulario,
    error,
    guardando,
    puedeCrearMedicamento,
    crearMedicamentoNuevo,
    creandoMedicamento,
    errorMedicamento,
  };
}
