import { useState, useEffect, useMemo } from "react";
import { obtenerSupabase } from "../api/cliente.js";

const TODAS = "__todas__";

export function useReporteInventario() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [bodegaId, setBodegaId] = useState(TODAS);
  const [estadoVencimiento, setEstadoVencimiento] = useState("todos");
  const [soloActivos, setSoloActivos] = useState(true);

  // Datos
  const [listaBodegas, setListaBodegas] = useState([]);
  const [registros, setRegistros] = useState([]);

  // ✅ CARGAR BODEGAS POR SEPARADO (desde tabla bodegas)
  const cargarBodegas = async () => {
    const supabase = obtenerSupabase();
    try {
      const { data, err } = await supabase
        .from("bodegas")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (err) throw err;
      setListaBodegas(data || []);
    } catch (err) {
      console.warn("No se pudieron cargar las bodegas:", err.message);
      setListaBodegas([]);
    }
  };

  // ─── Cargar inventario ───
  const cargarInventario = async () => {
    const supabase = obtenerSupabase();
    setCargando(true);
    setError(null);

    try {
      const hoy = new Date();
      const treintaDias = new Date();
      treintaDias.setDate(hoy.getDate() + 30);

      let consulta = supabase
        .from("lotes_existencias")
        .select(`
          cantidad,
          medicamento_id,
          medicamentos (nombre, concentracion, presentacion, marca, activo),
          numero_lote,
          fecha_vencimiento,
          bodega_id,
          bodegas (nombre, es_movil)
        `);

      if (soloActivos) {
        consulta = consulta.eq("medicamentos.activo", true);
      }
      if (bodegaId && bodegaId !== TODAS) {
        consulta = consulta.eq("bodega_id", bodegaId);
      }

      const { data, err } = await consulta;
      if (err) throw err;

      // 🧮 Calcular estado de vencimiento
      const procesados = (data || []).map((r) => {
        const fechaVenc = r.fecha_vencimiento ? new Date(r.fecha_vencimiento) : null;
        let estado = "sin_fecha";
        if (fechaVenc) {
          if (fechaVenc < hoy) estado = "vencido";
          else if (fechaVenc <= treintaDias) estado = "por_vencer";
          else estado = "vigente";
        }
        return {
          ...r,
          medicamento: r.medicamentos,
          bodega: r.bodegas,
          estadoVencimiento: estado,
          estaVencido: estado === "vencido",
        };
      });

      // 🔍 Aplicar filtro de vencimiento
      const filtrados = procesados.filter((r) => {
        if (estadoVencimiento === "todos") return true;
        if (estadoVencimiento === "vigente") return !r.estaVencido;
        return r.estadoVencimiento === estadoVencimiento;
      });

      setRegistros(filtrados);
    } catch (err) {
      setError(`No se pudo cargar inventario: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  // ─── Cargar TODO al iniciar ───
  useEffect(() => {
    cargarBodegas(); // ✅ Siempre carga las bodegas primero
  }, []);

  useEffect(() => {
    cargarInventario();
  }, [bodegaId, estadoVencimiento, soloActivos]);

  // ─── Totales calculados ───
  const totales = useMemo(() => {
    const disponibles = registros.filter((r) => !r.estaVencido);
    const vencidos = registros.filter((r) => r.estaVencido);
    const medicamentosUnicos = new Set(disponibles.map((r) => r.medicamento_id));

    return {
      unidadesDisponibles: disponibles.reduce((sum, r) => sum + Number(r.cantidad || 0), 0),
      unidadesVencidas: vencidos.reduce((sum, r) => sum + Number(r.cantidad || 0), 0),
      medicamentosDistintos: medicamentosUnicos.size,
      lotesVencidos: vencidos.length,
    };
  }, [registros]);

  // ─── Exportar CSV ───
  const obtenerCSV = () => {
    const encabezados = [
      "Medicamento", "Concentración", "Lote", "Bodega",
      "Cantidad", "Fecha Vencimiento", "Estado", "Medicamento Activo",
    ];
    const filas = registros.map((r) => [
      r.medicamento?.nombre || "Desconocido",
      r.medicamento?.concentracion || "-",
      r.numero_lote || "-",
      r.bodega?.nombre || "Sin bodega",
      r.cantidad,
      r.fecha_vencimiento || "Sin fecha",
      r.estaVencido ? " Vencido" : r.estadoVencimiento === "por_vencer" ? " Por vencer" : " Vigente",
      r.medicamento?.activo ? "Sí" : "No",
    ]);
    return { encabezados, filas };
  };

  return {
    valoresEspeciales: { TODAS },
    bodegaId, setBodegaId,
    estadoVencimiento, setEstadoVencimiento,
    soloActivos, setSoloActivos,
    opcionesVencimiento: [
      { valor: "todos", etiqueta: "Todos los lotes" },
      { valor: "vigente", etiqueta: "Solo vigentes" },
      { valor: "por_vencer", etiqueta: "Por vencer (30 días)" },
      { valor: "vencido", etiqueta: "Solo vencidos" },
    ],
    listaBodegas,
    cargando,
    error,
    registros,
    totales,
    obtenerCSV,
  };
}