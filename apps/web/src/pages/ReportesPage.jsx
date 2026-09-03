import { Link } from "react-router-dom";
import DashboardMetricasPage from "./DashboardMetricasPage";

export default function ReportesPage() {
  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* 📌 Cabecera UNA SOLA VEZ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0 }}>Reportes e Impacto</h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
            Métricas, estadísticas y volumen de atención
          </p>
        </div>

        {/* Botón que lleva al reporte detallado */}
        <Link
          to="/reportes/pacientes-atendidos"
          style={{
            padding: "10px 18px",
            backgroundColor: "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          📋 Ver Reporte Detallado de Pacientes
        </Link>
      </div>

      {/* 📊 Panel de métricas SIN título duplicado */}
      <DashboardMetricasPage />
    </div>
  );
}
