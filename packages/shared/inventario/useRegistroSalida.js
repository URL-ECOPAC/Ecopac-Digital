import { useState, useEffect } from "react";
// Asegúrate de importar supabase si aún no está importado arriba del todo:
// import { supabase } from "../utils/supabaseClient";

export function useRegistroSalida({ supabase, onExito }) {
  const [motivo, setMotivo] = useState("");
  const [medicamentoId, setMedicamentoId] = useState("");
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!medicamentoId) {
      setLotesDisponibles([]);
      setLoteSeleccionado(null);
      return;
    }

    const cargarLotesFEFO = async () => {
      setCargando(true);
      try {
        const { data: lotesData, error: err } = await supabase
          .from("lotes")
          .select("id, numero_lote, fecha_vencimiento, cantidad_ingresada")
          .eq("medicamento_id", medicamentoId)
          .order("fecha_vencimiento", { ascending: true });

        if (err) throw err;

        const lotesMapeados = (lotesData || []).map((lote) => ({
          lote_id: lote.id,
          numero_lote: lote.numero_lote,
          fecha_vencimiento: lote.fecha_vencimiento,
          cantidad_disponible: lote.cantidad_ingresada,
        }));

        setLotesDisponibles(lotesMapeados);

        if (lotesMapeados.length > 0) {
          setLoteSeleccionado(lotesMapeados[0]);
        } else {
          setLoteSeleccionado(null);
        }
      } catch (err) {
        console.error("Detalle del error de Supabase:", err);
        setError("Error al cargar los lotes disponibles.");
      } finally {
        setCargando(false);
      }
    };

    cargarLotesFEFO();
  }, [medicamentoId, supabase]);

  const seleccionarLote = (lote) => {
    const hoy = new Date().toISOString().split("T")[0];
    if (lote.fecha_vencimiento < hoy) {
      setError(
        `El lote ${lote.numero_lote} está vencido (Caducó el ${lote.fecha_vencimiento}) y no puede ser seleccionado.`,
      );
      return;
    }
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

    if (Number(cantidad) > loteSeleccionado.cantidad_disponible) {
      setError(
        `La cantidad solicitada supera la existencia disponible del lote (${loteSeleccionado.cantidad_disponible} unidades).`,
      );
      return;
    }

    const payload = {
      motivo,
      medicamento_id: medicamentoId,
      lote_id: loteSeleccionado.lote_id,
      cantidad: Number(cantidad),
      estado: "pendiente",
    };

    try {
      setCargando(true);
      if (onExito) onExito(payload);
    } catch {
      setError("Error al registrar la salida de inventario.");
    } finally {
      setCargando(false);
    }
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
