import { useState, useEffect } from "react";
import { obtenerSupabase } from "../api/cliente.js";

// Valores especiales de filtro
const TODAS = "__todas__";
const NINGUNA = "__ninguna__";

export function useReportePacientes() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [comunidadId, setComunidadId] = useState(TODAS);
  const [jornadaId, setJornadaId] = useState(TODAS);

  // Datos
  const [datos, setDatos] = useState(null);
  const [listaComunidades, setListaComunidades] = useState([]);
  const [listaJornadas, setListaJornadas] = useState([]);

  // ─── Cargar reporte desde la VISTA que ya funciona ───
  const cargarReporte = async (filtros = {}) => {
    const supabase = obtenerSupabase();

    // ✅ Usamos la vista existente con los campos que SÍ existen
    let consulta = supabase.from("vista_reporte_impacto").select(`
        fecha,
        jornada_id,
        jornada,
        comunidad_id,
        comunidad,
        pacientes_atendidos
      `);

    // ✅ Filtro de fechas: usa el campo REAL "fecha", NO "fecha_atencion"
    if (filtros.fechaInicio && filtros.fechaFin) {
      consulta = consulta.gte("fecha", filtros.fechaInicio).lte("fecha", filtros.fechaFin);
    }

    // ✅ Filtro por comunidad
    if (filtros.comunidadId && filtros.comunidadId !== TODAS) {
      consulta = consulta.eq("comunidad_id", filtros.comunidadId);
    }

    // ✅ Filtro por jornada
    if (filtros.jornadaId && filtros.jornadaId !== TODAS) {
      consulta = consulta.eq("jornada_id", filtros.jornadaId);
    }

    const { data: registros, error: err } = await consulta;
    if (err) throw err;
    if (!registros || registros.length === 0) return null;

    // 📋 Cargar listas para filtros
    const comunidadesSet = new Map();
    const jornadasSet = new Map();
    registros.forEach((r) => {
      const comId = r.comunidad_id;
      const comNom = r.comunidad || "Sin comunidad";
      const jorId = r.jornada_id;
      const jorNom = r.jornada || "Sin jornada";

      if (comId && !comunidadesSet.has(comId)) {
        comunidadesSet.set(comId, { id: comId, nombre: comNom });
      }
      if (jorId && !jornadasSet.has(jorId)) {
        jornadasSet.set(jorId, { id: jorId, nombre: jorNom });
      }
    });
    setListaComunidades(Array.from(comunidadesSet.values()));
    setListaJornadas(Array.from(jornadasSet.values()));

    // 🧮 Calcular totales y agrupaciones
    const totalPacientes = registros.reduce(
      (sum, r) => sum + Number(r.pacientes_atendidos || 0),
      0,
    );

    const porComunidad = {};
    const porJornada = {};

    registros.forEach((r) => {
      const comunidad = r.comunidad || "Sin comunidad";
      const jornada = r.jornada || "Sin jornada";
      const cantidad = Number(r.pacientes_atendidos || 0);

      if (!porComunidad[comunidad]) porComunidad[comunidad] = { nombre: comunidad, cantidad: 0 };
      if (!porJornada[jornada]) porJornada[jornada] = { nombre: jornada, cantidad: 0 };

      porComunidad[comunidad].cantidad += cantidad;
      porJornada[jornada].cantidad += cantidad;
    });

    return {
      totales: {
        totalPacientes,
        // ⚠️ Nota: La vista NO tiene datos por paciente individual (sexo, edad, nuevos/recurrentes)
        // Esos campos se muestran como "no disponible" hasta que se cree la vista detallada
        nuevos: "N/D",
        recurrentes: "N/D",
        porSexo: { masculino: "N/D", femenino: "N/D", otro: "N/D" },
        porEdad: { "0-11": "N/D", "12-17": "N/D", "18-30": "N/D", "31-59": "N/D", "60+": "N/D" },
      },
      porComunidad: Object.values(porComunidad),
      porJornada: Object.values(porJornada),
      filas: registros.map((r) => ({
        fecha: r.fecha,
        jornada: r.jornada,
        comunidad: r.comunidad,
        pacientes_atendidos: r.pacientes_atendidos,
      })),
    };
  };

  // ─── Recargar al cambiar filtros ───
  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const resultado = await cargarReporte({
          fechaInicio,
          fechaFin,
          comunidadId,
          jornadaId,
        });
        setDatos(resultado);
      } catch (err) {
        setError(`No se pudo cargar: ${err.message}`);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [fechaInicio, fechaFin, comunidadId, jornadaId]);

  // ─── Datos para CSV ───
  const obtenerDatosCSV = () => {
    if (!datos) return null;
    const encabezados = ["Fecha", "Comunidad", "Jornada", "Pacientes Atendidos"];
    const filas = datos.filas.map((f) => [f.fecha, f.comunidad, f.jornada, f.pacientes_atendidos]);
    return { encabezados, filas };
  };

  return {
    // Filtros
    valoresEspeciales: { TODAS },
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    comunidadId,
    setComunidadId,
    jornadaId,
    setJornadaId,
    // Listas
    listaComunidades,
    listaJornadas,
    // Resultados
    cargando,
    error,
    totales: datos?.totales || {},
    porComunidad: datos?.porComunidad || [],
    porJornada: datos?.porJornada || [],
    obtenerDatosCSV,
  };
}
