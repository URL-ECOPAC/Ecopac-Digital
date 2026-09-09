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
 * distinguir el origen. Vincular un ingreso a una donacion ya registrada con su propio detalle
 * es una operacion distinta -generarIngresoDesdeDonacion(), donaciones/ingreso.api.js- que ya
 * tiene su propio flujo en otra parte del modulo y esta issue no toca.
 *
 * `rol` (issue #165, criterio 1) habilita `puedeCrearMedicamento` y `crearMedicamentoNuevo()`.
 * Es opcional y no cambia nada de lo que ya usa #156: sin `rol`, `puedeCrearMedicamento` da
 * `false` (mismo resultado que `puedeAdministrarMedicamentos(undefined)`) y las dos funciones
 * nuevas simplemente quedan sin usar.
 *
 * @param {{ usuarioId?: string, rol?: string, onGuardarExitoso?: (movimientos: object[]) => void }} [opciones]
 */
export function useRegistroIngreso({ usuarioId, rol, onGuardarExitoso } = {}) {
  const [origen, setOrigenState] = useState("compra"); // 'compra' | 'donacion'
  const [proveedorId, setProveedorId] = useState("");
  const [numeroComprobante, setNumeroComprobante] = useState("");

  const [items, setItems] = useState([]);
  const [itemActual, setItemActual] = useState(ITEM_VACIO);

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

    setItemActual(ITEM_VACIO);
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
    if (onGuardarExitoso) onGuardarExitoso(movimientos);
    return true;
  };

  const resetFormulario = () => {
    setOrigenState("compra");
    setProveedorId("");
    setNumeroComprobante("");
    setItems([]);
    setItemActual(ITEM_VACIO);
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
