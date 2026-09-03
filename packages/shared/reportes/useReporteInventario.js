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

  // ✅ Cargar bodegas directamente desde su tabla
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

  // ─── Cargar inventario desde EXISTENCIAS + LOTES ───
  const cargarInventario = async () => {
    const supabase = obtenerSupabase();
    setCargando(true);
    setError(null);

    try {
      const hoy = new Date();
      const treintaDias = new Date();
      treintaDias.setDate(hoy.getDate() + 30);
      const hoyStr = hoy.toISOString().slice(0, 10);
      const treintaDiasStr = treintaDias.toISOString().slice(0, 10);

      // ✅ Estructura REAL: existencias → lotes → medicamentos
      let consulta = supabase.from("existencias").select(`
          id,
          cantidad_disponible,
          lote_id,
          bodega_id,
          lotes (
            id,
            numero_lote,
            fecha_vencimiento,
            fecha_ingreso,
            cantidad_ingresada,
            origen,
            medicamento_id,
            medicamentos (nombre, concentracion, presentacion, marca, activo),
            proveedor_id,
            proveedores (nombre)
          ),
          bodegas (nombre, es_movil)
        `);

      // Filtro por bodega
      if (bodegaId && bodegaId !== TODAS) {
        consulta = consulta.eq("bodega_id", bodegaId);
      }

      const { data, err } = await consulta;
      if (err) throw err;

      // 🧮 Calcular estado de vencimiento y desestructurar
      const procesados = (data || []).map((r) => {
        const lote = r.lotes || {};
        const medicamento = lote.medicamentos || {};
        const bodega = r.bodegas || {};
        const fechaVenc = lote.fecha_vencimiento ? new Date(lote.fecha_vencimiento) : null;

        let estado = "sin_fecha";
        let estaVencido = false;
        if (fechaVenc) {
          estaVencido = fechaVenc < hoy;
          estado = estaVencido ? "vencido" : fechaVenc <= treintaDias ? "por_vencer" : "vigente";
        }

        return {
          id: r.id,
          cantidad_disponible: r.cantidad_disponible,
          medicamento_id: lote.medicamento_id,
          medicamento,
          numero_lote: lote.numero_lote,
          fecha_vencimiento: lote.fecha_vencimiento,
          fecha_ingreso: lote.fecha_ingreso,
          origen: lote.origen,
          cantidad_ingresada: lote.cantidad_ingresada,
          bodega_id: r.bodega_id,
          bodega,
          estadoVencimiento: estado,
          estaVencido,
        };
      });

      // 🔍 Aplicar filtros combinados
      const filtrados = procesados.filter((r) => {
        // Filtro por medicamento activo
        if (soloActivos && r.medicamento.activo === false) return false;
        // Filtro por estado de vencimiento
        if (estadoVencimiento === "vigente") return !r.estaVencido;
        if (estadoVencimiento === "vencido") return r.estaVencido;
        if (estadoVencimiento === "por_vencer") return r.estadoVencimiento === "por_vencer";
        return true; // "todos"
      });

      setRegistros(filtrados);
    } catch (err) {
      setError(`No se pudo cargar inventario: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  // ─── Cargar datos ───
  useEffect(() => {
    cargarBodegas();
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
      unidadesDisponibles: disponibles.reduce(
        (sum, r) => sum + Number(r.cantidad_disponible || 0),
        0,
      ),
      unidadesVencidas: vencidos.reduce((sum, r) => sum + Number(r.cantidad_disponible || 0), 0),
      medicamentosDistintos: medicamentosUnicos.size,
      lotesVencidos: vencidos.length,
    };
  }, [registros]);

  // ─── Exportar CSV ───
  const obtenerCSV = () => {
    const encabezados = [
      "Medicamento",
      "Concentración",
      "Lote",
      "Bodega",
      "Cantidad Disponible",
      "Fecha Vencimiento",
      "Estado",
      "Medicamento Activo",
    ];
    const filas = registros.map((r) => [
      r.medicamento?.nombre || "Desconocido",
      r.medicamento?.concentracion || "-",
      r.numero_lote || "-",
      r.bodega?.nombre || "Sin bodega",
      r.cantidad_disponible,
      r.fecha_vencimiento || "Sin fecha",
      r.estaVencido
        ? "❌ Vencido"
        : r.estadoVencimiento === "por_vencer"
          ? "⚠️ Por vencer"
          : "✅ Vigente",
      r.medicamento?.activo ? "Sí" : "No",
    ]);
    return { encabezados, filas };
  };

  return {
    valoresEspeciales: { TODAS },
    bodegaId,
    setBodegaId,
    estadoVencimiento,
    setEstadoVencimiento,
    soloActivos,
    setSoloActivos,
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
