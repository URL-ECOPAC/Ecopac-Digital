import { useState, useCallback } from "react";
import { obtenerSupabase } from "../api/cliente.js";
import { cerrarAtencion } from "../atenciones/atenciones.api.js";

// ✅ Validaciones centralizadas (reglas de negocio)
export function validarEntrega(medicamento, cantidadEntregada, existenciasDisponibles) {
  const errores = [];

  // RF-20: No se puede entregar medicamento vencido
  if (medicamento.vencido) {
    errores.push(" No se puede entregar: el medicamento está vencido");
  }

  // Cantidad mayor a existencia disponible
  if (Number(cantidadEntregada) > Number(existenciasDisponibles)) {
    errores.push(` Solo hay ${existenciasDisponibles} unidades disponibles`);
  }

  // Cantidad debe ser positiva
  if (cantidadEntregada <= 0) {
    errores.push("La cantidad debe ser mayor a cero");
  }

  return errores;
}

export function useEntregaMedicamentos({ atencionId, pacienteId, rolEntregador }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [receta, setReceta] = useState([]);
  const [entrega, setEntrega] = useState({}); // { detalleId: cantidadEntregada }

  // Buscar receta del paciente
  const cargarReceta = useCallback(async () => {
    if (!atencionId) return;
    try {
      setCargando(true);
      setError(null);
      const supabase = obtenerSupabase();

      const { data, err } = await supabase
        .from("vista_receta_entrega")
        .select("*")
        .eq("atencion_id", atencionId);

      if (err) throw err;
      setReceta(data || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la receta");
    } finally {
      setCargando(false);
    }
  }, [atencionId]);

  // Registrar cantidad entregada de un renglón
  const registrarCantidad = useCallback((detalleId, cantidad) => {
    setEntrega((prev) => ({
      ...prev,
      [detalleId]: cantidad,
    }));
  }, []);

  // ✅ Generar movimientos de salida + cerrar atención al finalizar
  const confirmarEntrega = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const supabase = obtenerSupabase();
      const movimientosSalida = [];

      // Crear movimiento de salida por cada renglón entregado
      for (const detalle of receta) {
        const cantidadEntregada = Number(entrega[detalle.id] || 0);
        if (cantidadEntregada <= 0) continue;

        // Determinar estado según rol: administrador → aprobado, otros → pendiente
        const estadoMovimiento = rolEntregador === "administrador"
          ? "aprobado"
          : "pendiente_validacion";

        movimientosSalida.push({
          tipo: "salida",
          medicamento_id: detalle.medicamento_id,
          lote_id: detalle.lote_id,
          cantidad: cantidadEntregada,
          atencion_id: atencionId,
          receta_detalle_id: detalle.id,
          estado: estadoMovimiento,
          motivo: "entrega a paciente",
        });
      }

      // Insertar movimientos
      if (movimientosSalida.length > 0) {
        const { err: errMov } = await supabase
          .from("movimientos_inventario")
          .insert(movimientosSalida);
        if (errMov) throw errMov;
      }

      // ✅ Cerrar atención → paciente sale de la cola
      await cerrarAtencion(atencionId, "entrega completada");

      return { exito: true };
    } catch (err) {
      setError(err.message || "No se pudo registrar la entrega");
      return { exito: false };
    } finally {
      setCargando(false);
    }
  }, [receta, entrega, atencionId, rolEntregador]);

  return {
    receta,
    entrega,
    cargando,
    error,
    cargarReceta,
    registrarCantidad,
    confirmarEntrega,
    validarEntrega,
  };
}