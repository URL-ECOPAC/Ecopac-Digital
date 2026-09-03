// packages/shared/reportes/useDashboardMetricas.js
import { useState, useEffect } from "react";
import { obtenerSupabase } from "../api/cliente.js";

// ─── Opciones de configuración ───
const RANGOS = [
  { valor: "semana", etiqueta: "Última semana" },
  { valor: "mes", etiqueta: "Último mes" },
  { valor: "3meses", etiqueta: "Últimos 3 meses" },
  { valor: "año", etiqueta: "Último año" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

const AGRUPAMIENTOS = [
  { valor: "mes", etiqueta: "Por Mes" },
  { valor: "comunidad", etiqueta: "Por Comunidad" },
  { valor: "jornada", etiqueta: "Por Jornada" },
];

// Valores especiales (NO se envían a la BD)
const TODAS = "__todas__";
const NINGUNA = "__ninguna__";

// ─── Hook principal ───
export function useDashboardMetricas() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // 🔑 VALORES INICIALES CORREGIDOS — NUNCA "com1", "com2", etc.
  const [rangoSeleccionado, setRangoSeleccionado] = useState("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [agruparPor, setAgruparPor] = useState("mes");
  const [comunidadId, setComunidadId] = useState(TODAS); // ✅ Valor seguro

  // Comparación
  const [modoComparacion, setModoComparacion] = useState(false);
  const [comunidadCompararId, setComunidadCompararId] = useState(NINGUNA); // ✅ Valor seguro

  // Datos
  const [datos, setDatos] = useState(null);
  const [datosComparacion, setDatosComparacion] = useState(null);
  const [listaComunidades, setListaComunidades] = useState([]);

  // ─── Consultar la vista en Supabase ───
  const cargarDesdeVista = async (filtros = {}) => {
    const supabase = obtenerSupabase();

    let consulta = supabase
      .from("vista_reporte_impacto")
      .select(
        `
        jornada_id,
        jornada,
        fecha,
        comunidad_id,
        comunidad,
        pacientes_atendidos,
        consultas_realizadas,
        tratamientos_entregados,
        medicamentos_utilizados
      `,
      )
      .order("fecha", { ascending: true });

    // Filtrar por rango de fechas
    if (filtros.fechaInicio && filtros.fechaFin) {
      consulta = consulta.gte("fecha", filtros.fechaInicio).lte("fecha", filtros.fechaFin);
    }

    // ✅ SOLO filtrar si es un UUID real — NUNCA enviar valores especiales
    const idComunidad = filtros.comunidadId;
    if (
      idComunidad &&
      idComunidad !== TODAS &&
      idComunidad !== NINGUNA &&
      idComunidad.length > 10
    ) {
      consulta = consulta.eq("comunidad_id", idComunidad);
    }

    const { data, error: errVista } = await consulta;
    if (errVista) throw errVista;
    if (!data || data.length === 0) return null;

    // ✅ Extraer lista real de comunidades
    const comunidadesUnicas = [];
    const vistas = new Set();
    data.forEach((fila) => {
      if (fila.comunidad_id && fila.comunidad && !vistas.has(fila.comunidad_id)) {
        vistas.add(fila.comunidad_id);
        comunidadesUnicas.push({
          id: fila.comunidad_id, // UUID real
          nombre: fila.comunidad,
        });
      }
    });
    setListaComunidades(comunidadesUnicas);

    // 🧮 Calcular indicadores
    const indicadores = {
      pacientesAtendidos: data.reduce((sum, f) => sum + Number(f.pacientes_atendidos || 0), 0),
      comunidadesBeneficiadas: new Set(data.map((f) => f.comunidad_id)).size,
      tratamientosEntregados: data.reduce(
        (sum, f) => sum + Number(f.tratamientos_entregados || 0),
        0,
      ),
      medicamentosUtilizados: data.reduce(
        (sum, f) => sum + Number(f.medicamentos_utilizados || 0),
        0,
      ),
    };

    // 📈 Agrupar datos
    const agruparDatos = (data, tipo) => {
      const agrupado = {};
      data.forEach((fila) => {
        let clave;
        if (tipo === "mes") {
          const fecha = new Date(fila.fecha);
          clave = isNaN(fecha.getTime())
            ? "Sin fecha"
            : fecha.toLocaleDateString("es-GT", { month: "short" });
        } else if (tipo === "comunidad") {
          clave = fila.comunidad || "Sin comunidad";
        } else if (tipo === "jornada") {
          clave = fila.jornada || "Sin nombre";
        } else {
          clave = "Total";
        }
        if (!agrupado[clave]) agrupado[clave] = { etiqueta: clave, valor: 0 };
        agrupado[clave].valor += Number(fila.pacientes_atendidos || 0);
      });
      return Object.values(agrupado);
    };

    const serie = agruparDatos(data, filtros.agruparPor || "mes");
    return { indicadores, serie, filas: data };
  };

  // ─── Recargar automáticamente ───
  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError(null);

      try {
        let fin = new Date();
        let inicio = new Date();
        if (rangoSeleccionado === "semana") inicio.setDate(fin.getDate() - 7);
        else if (rangoSeleccionado === "mes") inicio.setMonth(fin.getMonth() - 1);
        else if (rangoSeleccionado === "3meses") inicio.setMonth(fin.getMonth() - 3);
        else if (rangoSeleccionado === "año") inicio.setFullYear(fin.getFullYear() - 1);
        else {
          inicio = fechaInicio ? new Date(fechaInicio) : inicio;
          fin = fechaFin ? new Date(fechaFin) : fin;
        }

        const formatoFecha = (d) => d.toISOString().slice(0, 10);

        // Datos principales
        const principal = await cargarDesdeVista({
          fechaInicio: formatoFecha(inicio),
          fechaFin: formatoFecha(fin),
          comunidadId,
          agruparPor,
        });
        setDatos(principal);

        // Datos de comparación
        if (modoComparacion && comunidadCompararId !== NINGUNA) {
          const comparada = await cargarDesdeVista({
            fechaInicio: formatoFecha(inicio),
            fechaFin: formatoFecha(fin),
            comunidadId: comunidadCompararId,
            agruparPor,
          });
          setDatosComparacion(comparada);
        } else {
          setDatosComparacion(null);
        }
      } catch (err) {
        console.error("❌ Error:", err);
        setError(`No se pudo cargar: ${err.message}`);
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, [
    rangoSeleccionado,
    fechaInicio,
    fechaFin,
    comunidadId,
    agruparPor,
    modoComparacion,
    comunidadCompararId,
  ]);

  // ─── Variación porcentual ───
  const calcularVariacion = (valorActual, valorBase) => {
    if (!valorBase || valorBase === 0) return null;
    return ((valorActual - valorBase) / valorBase) * 100;
  };

  return {
    // Opciones
    rangosDisponibles: RANGOS,
    agrupamientosDisponibles: AGRUPAMIENTOS,
    valoresEspeciales: { TODAS, NINGUNA },

    // Filtros
    rangoSeleccionado,
    setRangoSeleccionado,
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    agruparPor,
    setAgruparPor,
    comunidadId,
    setComunidadId,

    // Comparación
    modoComparacion,
    setModoComparacion,
    comunidadCompararId,
    setComunidadCompararId,

    // Lista real
    listaComunidades,

    // Resultados
    cargando,
    error,
    indicadores: datos?.indicadores || {},
    seriePrincipal: datos?.serie || [],
    serieComparacion: datosComparacion?.serie || [],
    calcularVariacion,
  };
}
