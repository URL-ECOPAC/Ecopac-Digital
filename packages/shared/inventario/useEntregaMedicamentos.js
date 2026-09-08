import { useState, useEffect } from "react";
import { obtenerSupabase } from "../api/cliente.js";

const TODAS = "__todas__";

/** Calcula si un lote está vencido */
function estaVencido(fechaVencimiento) {
  if (!fechaVencimiento) return false;
  return new Date(fechaVencimiento) < new Date();
}

/** Calcula días restantes o 0 si ya venció */
function diasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return 9999;
  const hoy = new Date();
  const venc = new Date(fechaVencimiento);
  const diff = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function useEntregaMedicamentos(atencionId) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [receta, setReceta] = useState(null);
  const [detalles, setDetalles] = useState([]);

  useEffect(() => {
    if (!atencionId) return;

    async function cargarReceta() {
      try {
        setCargando(true);
        setError(null);
        const supabase = obtenerSupabase();

        // ✅ Consulta DIRECTAMENTE a las tablas existentes — SIN vista
        const { data, err } = await supabase
          .from("receta_detalle")
          .select(`
            id,
            cantidad_recetada,
            cantidad_entregada,
            receta:receta_id (
              id,
              paciente_id,
              paciente:paciente_id (
                nombres,
                apellidos,
                numero_ficha
              )
            ),
            medicamento:medicamento_id (
              id,
              nombre
            ),
            lote:lote_id (
              id,
              numero_lote,
              vencimiento,
              cantidad_actual
            )
          `)
          .eq("receta.atencion_id", atencionId);

        if (err) throw err;

        if (!data || data.length === 0) {
          setDetalles([]);
          setReceta(null);
          return;
        }

        // ✅ Extrae datos generales de la receta del primer detalle
        const primerDetalle = data[0];
        setReceta({
          id: primerDetalle.receta?.id,
          paciente_id: primerDetalle.receta?.paciente_id,
          paciente_nombre: `${primerDetalle.receta?.paciente?.nombres || ""} ${primerDetalle.receta?.paciente?.apellidos || ""}`.trim(),
          numero_ficha: primerDetalle.receta?.paciente?.numero_ficha,
        });

        // ✅ Transforma cada línea para la pantalla
        setDetalles(data.map((d) => ({
          id: d.id,
          medicamento_id: d.medicamento?.id,
          medicamento: d.medicamento?.nombre || "Medicamento desconocido",
          lote_id: d.lote?.id,
          numero_lote: d.lote?.numero_lote || "Sin lote",
          cantidad_recetada: d.cantidad_recetada,
          cantidad_entregada: d.cantidad_entregada || 0,
          existencia_disponible: d.lote?.cantidad_actual || 0,
          vencimiento: d.lote?.vencimiento,
          dias_restantes: diasRestantes(d.lote?.vencimiento),
          esta_vencido: estaVencido(d.lote?.vencimiento),
        })));

      } catch (e) {
        console.error("Error cargando receta:", e);
        setError(e.message || "Error al cargar los medicamentos");
      } finally {
        setCargando(false);
      }
    }

    cargarReceta();
  }, [atencionId]);

  return {
    cargando,
    error,
    receta,
    detalles,
  };
}