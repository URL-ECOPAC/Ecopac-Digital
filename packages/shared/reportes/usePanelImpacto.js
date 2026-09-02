// packages/shared/reportes/usePanelImpacto.js
import { useState, useEffect } from "react";

// ─── Configuración ───
const METRICAS = [
  { valor: "pacientes", etiqueta: "Pacientes Atendidos", meta: 3000, color: "#10b981" },
  { valor: "jornadas", etiqueta: "Jornadas Realizadas", meta: 4, color: "#3b82f6" },
  { valor: "voluntarios", etiqueta: "Voluntarios Activos", meta: 10, color: "#f59e0b" },
  { valor: "presupuesto", etiqueta: "Presupuesto Asignado", meta: 750000, color: "#ec4899", moneda: "Q" },
];

const AGRUPAMIENTOS = [
  { valor: "mes", etiqueta: "Por Mes", campo: "fecha" },
  { valor: "comunidad", etiqueta: "Por Comunidad", campo: "comunidad_id" },
  { valor: "jornada", etiqueta: "Por Jornada", campo: "jornada_id" },
  { valor: "proyecto", etiqueta: "Por Proyecto", campo: "proyecto_id" },
];

const RANGOS = [
  { valor: "semana", etiqueta: "Última semana" },
  { valor: "mes", etiqueta: "Último mes" },
  { valor: "3meses", etiqueta: "Últimos 3 meses" },
  { valor: "año", etiqueta: "Último año" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

const ESTADOS_JORNADA = {
  planificada: { etiqueta: "Planificada", color: "#d97706" },
  en_curso: { etiqueta: "En curso", color: "#2563eb" },
  completada: { etiqueta: "Completada", color: "#059669" },
  cancelada: { etiqueta: "Cancelada", color: "#dc2626" },
};

// ─── Hook ───
export function usePanelImpacto() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Filtros principales
  const [rangoSeleccionado, setRangoSeleccionado] = useState("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [comunidadId, setComunidadId] = useState("todas");
  const [proyectoId, setProyectoId] = useState("todos");
  const [estadoJornada, setEstadoJornada] = useState("todos");

  // Comparación
  const [modoComparacion, setModoComparacion] = useState(false);
  const [filtroComparacion, setFiltroComparacion] = useState({
    proyectoId: "ninguno",
    comunidadId: "ninguna",
  });

  // Datos resultantes
  const [metricas, setMetricas] = useState([]);
  const [seriePrincipal, setSeriePrincipal] = useState([]);
  const [serieComparacion, setSerieComparacion] = useState([]);
  const [resumenPersonal, setResumenPersonal] = useState({ total: 0, roles: {} });

  // ─── Cargar datos automáticamente ───
  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      setError(null);

      try {
        // =====================================================
        // ✅ CUANDO LA API ESTÉ LISTA, USA ESTE CÓDIGO:
        // =====================================================
        // const respuesta = await fetch("/api/reportes/panel-impacto", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({
        //     rango: rangoSeleccionado,
        //     fechaInicio,
        //     fechaFin,
        //     comunidadId,
        //     proyectoId,
        //     estado: estadoJornada,
        //   }),
        // });
        // if (!respuesta.ok) throw new Error("Error al consultar indicadores");
        // const datos = await respuesta.json();
        // setMetricas(datos.metricas);
        // setSeriePrincipal(datos.seriePrincipal);
        // setResumenPersonal(datos.resumenPersonal);
        //
        // if (modoComparacion) {
        //   const respComp = await fetch("/api/reportes/panel-impacto", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({
        //       rango: rangoSeleccionado,
        //       fechaInicio,
        //       fechaFin,
        //       comunidadId: filtroComparacion.comunidadId,
        //       proyectoId: filtroComparacion.proyectoId,
        //       estado: estadoJornada,
        //     }),
        //   });
        //   const datosComp = await respComp.json();
        //   setSerieComparacion(datosComp.seriePrincipal);
        // } else {
        //   setSerieComparacion([]);
        // }
        // =====================================================
        // 🧪 MIENTRAS TANTO, USAMOS DATOS DE EJEMPLO:
        // =====================================================
        const datosSimulados = generarDatosEjemplo({
          rango: rangoSeleccionado,
          comunidadId,
          proyectoId,
          estado: estadoJornada,
        });

        setMetricas(datosSimulados.metricas);
        setSeriePrincipal(datosSimulados.seriePrincipal);
        setResumenPersonal(datosSimulados.resumenPersonal);

        if (modoComparacion) {
          setSerieComparacion(
            generarDatosEjemplo({
              rango: rangoSeleccionado,
              comunidadId: filtroComparacion.comunidadId,
              proyectoId: filtroComparacion.proyectoId,
              estado: estadoJornada,
            }).seriePrincipal
          );
        } else {
          setSerieComparacion([]);
        }
      } catch (err) {
        setError("Error al calcular indicadores: " + err.message);
      } finally {
        setCargando(false);
      }
    };

    const temporizador = setTimeout(cargarDatos, 350);
    return () => clearTimeout(temporizador);
  }, [rangoSeleccionado, comunidadId, proyectoId, estadoJornada, modoComparacion, filtroComparacion]);

  // ─── Calcular variación porcentual ───
  const calcularVariacion = (valorActual, valorBase) => {
    if (!valorBase || valorBase === 0) return null;
    return ((valorActual - valorBase) / valorBase) * 100;
  };

  // ─── Exportar a CSV ───
  const exportarCSV = () => {
    const encabezados = ["Agrupamiento", "Valor Principal", "Valor Comparado", "Variación %"];
    const filas = seriePrincipal.map((fila, i) => {
      const comparada = serieComparacion[i];
      const variacion = comparada ? calcularVariacion(fila.valor, comparada.valor) : null;
      return [
        fila.etiqueta,
        fila.valor,
        comparada?.valor || "-",
        variacion !== null ? `${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)}%` : "-",
      ];
    });

    const contenido = [encabezados, ...filas].map((fila) => fila.join(",")).join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `panel-impacto-${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return {
    // Opciones
    rangosDisponibles: RANGOS,
    metricasDisponibles: METRICAS,
    agrupamientosDisponibles: AGRUPAMIENTOS,
    estadosJornada: ESTADOS_JORNADA,

    // Filtros
    rangoSeleccionado,
    setRangoSeleccionado,
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    comunidadId,
    setComunidadId,
    proyectoId,
    setProyectoId,
    estadoJornada,
    setEstadoJornada,

    // Comparación
    modoComparacion,
    setModoComparacion,
    filtroComparacion,
    setFiltroComparacion,

    // Datos
    cargando,
    error,
    metricas,
    seriePrincipal,
    serieComparacion,
    resumenPersonal,

    // Acciones
    calcularVariacion,
    exportarCSV,
  };
}

// ─── Datos de ejemplo alineados con tablas reales ───
function generarDatosEjemplo(filtros) {
  const jornadas = [
    { fecha: "2026-04-15", proyecto_id: "p1", comunidad_id: "com1", estado: "completada", presupuesto_asignado: 1500.0, pacientes: 47 },
    { fecha: "2026-05-20", proyecto_id: "p1", comunidad_id: "com2", estado: "completada", presupuesto_asignado: 1800.0, pacientes: 52 },
    { fecha: "2026-06-10", proyecto_id: "p2", comunidad_id: "com1", estado: "en_curso", presupuesto_asignado: 2200.0, pacientes: 38 },
    { fecha: "2026-07-05", proyecto_id: "p3", comunidad_id: "com3", estado: "planificada", presupuesto_asignado: 900.0, pacientes: 0 },
  ];

  const personal = [
    { jornada_id: "j1", rol_en_jornada: "MEDICO" },
    { jornada_id: "j1", rol_en_jornada: "ENFERMERIA" },
    { jornada_id: "j1", rol_en_jornada: "APOYO" },
    { jornada_id: "j2", rol_en_jornada: "MEDICO" },
    { jornada_id: "j2", rol_en_jornada: "APOYO" },
  ];

  // Aplicar filtros
  let filtradas = jornadas;
  if (filtros.proyectoId && filtros.proyectoId !== "todos") {
    filtradas = filtradas.filter((j) => j.proyecto_id === filtros.proyectoId);
  }
  if (filtros.comunidadId && filtros.comunidadId !== "todas") {
    filtradas = filtradas.filter((j) => j.comunidad_id === filtros.comunidadId);
  }
  if (filtros.estado && filtros.estado !== "todos") {
    filtradas = filtradas.filter((j) => j.estado === filtros.estado);
  }

  // Calcular métricas
  const totalPacientes = filtradas.reduce((s, j) => s + j.pacientes, 0);
  const totalJornadas = filtradas.length;
  const totalPresupuesto = filtradas.reduce((s, j) => s + j.presupuesto_asignado, 0);
  const personalUnico = new Set(personal.map((p) => p.jornada_id)).size;

  // Agrupar por mes
  const porMes = [
    { etiqueta: "Abr", valor: filtradas.filter((j) => j.fecha.slice(5, 7) === "04").reduce((s, j) => s + j.pacientes, 0) },
    { etiqueta: "May", valor: filtradas.filter((j) => j.fecha.slice(5, 7) === "05").reduce((s, j) => s + j.pacientes, 0) },
    { etiqueta: "Jun", valor: filtradas.filter((j) => j.fecha.slice(5, 7) === "06").reduce((s, j) => s + j.pacientes, 0) },
    { etiqueta: "Jul", valor: filtradas.filter((j) => j.fecha.slice(5, 7) === "07").reduce((s, j) => s + j.pacientes, 0) },
  ];

  return {
    metricas: METRICAS.map((m) => {
      let valor = 0;
      if (m.valor === "pacientes") valor = totalPacientes;
      if (m.valor === "jornadas") valor = totalJornadas;
      if (m.valor === "voluntarios") valor = personalUnico;
      if (m.valor === "presupuesto") valor = Math.round(totalPresupuesto);
      return { ...m, valor };
    }),
    seriePrincipal: porMes,
    resumenPersonal: {
      total: personalUnico,
      roles: personal.reduce((ac, p) => {
        ac[p.rol_en_jornada] = (ac[p.rol_en_jornada] || 0) + 1;
        return ac;
      }, {}),
    },
  };
}