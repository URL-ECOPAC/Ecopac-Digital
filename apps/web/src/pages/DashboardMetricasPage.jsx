import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useDashboardMetricas } from "../../../../packages/shared/reportes/useDashboardMetricas.js";
import { useFiltrosReportes } from "../../../../packages/shared/reportes/useFiltrosReportes.js";
import BarraFiltrosReporte from "./BarraFiltrosReporte";
import { listarBodegas } from "../../../../packages/shared/inventario/bodegas.api.js";
import {
  CAMPOS_DASHBOARD,
  COLORES_GRAFICAS,
} from "../../../../packages/shared/reportes/dashboard.campos.js";

// 📊 Tarjeta de métrica alineada a Figma
const TarjetaMetrica = ({ etiqueta, valor, meta, color }) => (
  <div
    style={{
      backgroundColor: "#fff",
      borderRadius: "16px",
      padding: "20px",
      border: "1px solid #f1f5f9",
    }}
  >
    <p
      style={{
        fontSize: "12px",
        color: "#64748b",
        margin: "0 0 8px 0",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {etiqueta}
    </p>
    <p style={{ fontSize: "36px", fontWeight: "700", color: color, margin: "0 0 12px 0" }}>
      {valor}
    </p>
    {meta && (
      <div
        style={{
          height: "6px",
          backgroundColor: "#e2e8f0",
          borderRadius: "3px",
          overflow: "hidden",
          marginBottom: "6px",
        }}
      >
        <div
          style={{ height: "100%", backgroundColor: color, borderRadius: "3px", width: "70%" }}
        />
      </div>
    )}
    {meta && (
      <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "right" }}>meta: {meta}</div>
    )}
  </div>
);

export default function DashboardMetricasPage() {
  // Datos del dashboard desde el hook
  const {
    cargando,
    error,
    indicadores,
    evolucionMensual,
    porEspecialidad,
    topDonantes,
    estadoJornadas,
  } = useDashboardMetricas();

  // Filtros
  const { filtros, alCambiarFiltros } = useFiltrosReportes();

  // Listas para los desplegables
  const [comunidades, setComunidades] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [proyectos, setProyectos] = useState([]);

  // ✅ Cargar comunidades desde la API al iniciar
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const datosBodegas = await listarBodegas();
        const formateado = datosBodegas.map((b) => ({
          id: b.id || b.codigo || b.bodega_id,
          nombre: b.nombre || b.nombre_bodega || b.descripcion,
        }));
        setComunidades(formateado);
      } catch (err) {
        console.error("Error cargando comunidades:", err);
      }
    };
    cargarDatos();
  }, []);

  if (cargando)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
        Cargando métricas...
      </div>
    );
  if (error)
    return (
      <div style={{ padding: "40px", color: "#dc2626" }}>Error al cargar: {error.message}</div>
    );

  // Meses para la gráfica
  const meses = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* Título */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", margin: "0 0 4px 0" }}>
          Reportes e Impacto
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
          Métricas, estadísticas y volumen de atención 2024
        </p>
      </div>

      {/* 🔍 Barra de Filtros */}
      <BarraFiltrosReporte
        filtros={filtros}
        alCambiarFiltros={alCambiarFiltros}
        comunidades={comunidades}
        jornadas={jornadas}
        proyectos={proyectos}
      />

      {/* 📊 Tarjetas de métricas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <TarjetaMetrica
          etiqueta="Pacientes Atendidos"
          valor={indicadores?.pacientes || 0}
          meta="3000"
          color="#22c55e"
        />
        <TarjetaMetrica
          etiqueta="Jornadas Realizadas"
          valor={indicadores?.jornadas || 0}
          meta="4"
          color="#3b82f6"
        />
        <TarjetaMetrica
          etiqueta="Voluntarios Activos"
          valor={indicadores?.voluntarios || 0}
          meta="10"
          color="#f59e0b"
        />
        <TarjetaMetrica
          etiqueta="Donaciones Recibidas"
          valor={`Q ${indicadores?.donaciones || 0}`}
          meta="Q 750,000"
          color="#ec4899"
        />
      </div>

      {/* 📈 Gráficas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px" }}>
        {/* Gráfica por mes */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid #f1f5f9",
          }}
        >
          <h3
            style={{ fontSize: "16px", fontWeight: "600", color: "#1e293b", margin: "0 0 20px 0" }}
          >
            Pacientes atendidos por mes
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              height: "140px",
              padding: "0 4px",
            }}
          >
            {meses.map((nombre, i) => {
              const valor = evolucionMensual?.[i] || 0;
              const alto = valor > 0 ? Math.max((valor / 300) * 100, 8) : 4;
              const color = valor > 0 ? "#22c55e" : "#e2e8f0";
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "7%",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      backgroundColor: color,
                      borderRadius: "4px 4px 0 0",
                      height: `${alto}%`,
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>
                    {nombre}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfica por especialidad */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid #f1f5f9",
          }}
        >
          <h3
            style={{ fontSize: "16px", fontWeight: "600", color: "#1e293b", margin: "0 0 20px 0" }}
          >
            Atenciones por especialidad
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {porEspecialidad?.map((esp, i) => (
              <div key={i}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}
                >
                  <span style={{ fontSize: "14px", fontWeight: "500", color: "#334155" }}>
                    {esp.nombre}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: esp.color }}>
                    {esp.cantidad}
                  </span>
                </div>
                <div
                  style={{
                    height: "8px",
                    backgroundColor: "#f1f5f9",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min((esp.cantidad / 1540) * 100, 100)}%`,
                      height: "100%",
                      backgroundColor: esp.color,
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
