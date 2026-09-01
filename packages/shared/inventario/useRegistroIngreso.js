import { useState } from "react";

export function useRegistroIngreso({ donacionesDisponibles = [], onGuardarExitoso } = {}) {
  const [origen, setOrigenState] = useState("compra"); // 'compra' | 'donacion'
  const [donacionId, setDonacionId] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [numeroComprobante, setNumeroComprobante] = useState("");

  const [items, setItems] = useState([]);
  const [itemActual, setItemActual] = useState({
    medicamento_id: "",
    numero_lote: "",
    fecha_vencimiento: "",
    cantidad: "",
    bodega_id: "",
  });

  const [resumenGuardado, setResumenGuardado] = useState(null);
  const [error, setError] = useState(null);

  // Manejador para cambiar de origen y resetear campos no pertenecientes
  const setOrigen = (nuevoOrigen) => {
    setOrigenState(nuevoOrigen);
    setDonacionId("");
    setProveedor("");
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

    setItemActual({
      medicamento_id: "",
      numero_lote: "",
      fecha_vencimiento: "",
      cantidad: "",
      bodega_id: "",
    });
    setError(null);
  };

  const eliminarItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const guardarMovimiento = (usuarioActual) => {
    if (items.length === 0) {
      setError("Debes agregar al menos un medicamento al ingreso.");
      return;
    }

    if (origen === "donacion" && !donacionId) {
      setError("Debes vincular una donación existente.");
      return;
    }

    if (origen === "compra" && !proveedor.trim()) {
      setError("Debes ingresar el nombre o razón social del proveedor.");
      return;
    }

    // Adaptación a la Migración 00107 / Issue #625:
    // Los lotes que se crean aquí se registran como provisionales (confirmado = FALSE)
    const itemsProvisionales = items.map((item) => ({
      ...item,
      confirmado: false,
      registrado_por: usuarioActual?.id || null,
    }));

    const nuevoMovimiento = {
      id: `ING-${Date.now()}`,
      origen,
      donacion_id: origen === "donacion" ? donacionId : null,
      proveedor: origen === "compra" ? proveedor.trim() : null,
      numero_comprobante: numeroComprobante.trim(),
      estado: "PENDIENTE",
      registrado_por: usuarioActual?.nombre || "Usuario Actual",
      registrado_por_id: usuarioActual?.id || null,
      fecha_registro: new Date().toISOString(),
      items: itemsProvisionales,
    };

    setResumenGuardado(nuevoMovimiento);
    setError(null);
    if (onGuardarExitoso) onGuardarExitoso(nuevoMovimiento);
  };

  const resetFormulario = () => {
    setOrigenState("compra");
    setDonacionId("");
    setProveedor("");
    setNumeroComprobante("");
    setItems([]);
    setItemActual({
      medicamento_id: "",
      numero_lote: "",
      fecha_vencimiento: "",
      cantidad: "",
      bodega_id: "",
    });
    setResumenGuardado(null);
    setError(null);
  };

  return {
    origen,
    setOrigen,
    donacionId,
    setDonacionId,
    proveedor,
    setProveedor,
    numeroComprobante,
    setNumeroComprobante,
    items,
    itemActual,
    setItemActual,
    agregarItem,
    eliminarItem,
    guardarMovimiento,
    resumenGuardado,
    setResumenGuardado,
    resetFormulario,
    error,
  };
}
