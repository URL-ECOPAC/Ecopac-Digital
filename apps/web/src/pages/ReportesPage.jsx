import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardMetricasPage from "./DashboardMetricasPage";
import { useReporteMedicamentosPorVencer } from "../../../../packages/shared/reportes/useReporteMedicamentosPorVencer.js";
import { useExportarPDF } from "../../../../packages/shared/reportes/useExportarPDF";
import BotonExportarPDF from "../components/BotonExportarPDF";

// Estilos compartidos de pestañas
const estiloPestanaActiva = {
  padding: "10px 18px",
  fontSize: "14px",
  fontWeight: "600",
  border: "none",
  background: "none",
  cursor: "pointer",
  borderBottom: "2px solid #10b981",
  color: "#10b981",
};
const estiloPestanaInactiva = {
  padding: "10px 18px",
  fontSize: "14px",
  fontWeight: "500",
  border: "none",
  background: "none",
  cursor: "pointer",
  borderBottom: "2px solid transparent",
  color: "#64748b",
};

// Colores de alerta (coinciden con ui-tokens)
const coloresAlerta = {
  critico: { fondo: "#fef2f2", borde: "#fca5a5", texto: "#dc2626" },
  alto: { fondo: "#fffbeb", borde: "#fcd34d", texto: "#b45309" },
  medio: { fondo: "#f0fdf4", borde: "#86efac", texto: "#15803d" },
  normal: { fondo: "#f8fafc", borde: "#e2e8f0", texto: "#475569" },
};
const etiquetasAlerta = {
  critico: "🔴 Crítico",
  alto: "🟡 Alto",
  medio: "🟢 Medio",
  normal: "✅ Normal",
};

export default function ReportesPage() {
  const [pestanaActiva, setPestanaActiva] = useState("dashboard");

  // Hook del reporte de medicamentos por vencer
  const {
    cargando,
    error,
    filas,
    totalUnidadesEnRiesgo,
    horizonteDias,
    setHorizonteDias,
    comunidadId,
    setComunidadId,
    bodegaId,
    setBodegaId,
    horizontesDisponibles,
    listaComunidades,
    listaBodegas,
    valoresEspeciales,
    recargar,
  } = useReporteMedicamentosPorVencer();

  // 📄 Exportación PDF — issue #216
  const periodo = `Próximos ${horizonteDias} días`;
  const { exportar, generando } = useExportarPDF({
    tituloReporte: "Reporte de Medicamentos Próximos a Vencer",
    periodo,
  });

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* 📌 Cabecera */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0 }}>Reportes e Impacto</h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
              Métricas, estadísticas y volumen de atención
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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
              Ver Reporte Detallado de Pacientes
            </Link>
            {/* 📄 Botón PDF — SOLO visible en la pestaña de vencimientos */}
            {pestanaActiva === "vencimientos" && (
              <BotonExportarPDF onClick={exportar} generando={generando} />
            )}
          </div>
        </div>

        {/* 📑 Pestañas */}
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e2e8f0" }}>
          <button
            onClick={() => setPestanaActiva("dashboard")}
            style={pestanaActiva === "dashboard" ? estiloPestanaActiva : estiloPestanaInactiva}
          >
            Dashboard de Impacto
          </button>
          <button
            onClick={() => setPestanaActiva("vencimientos")}
            style={pestanaActiva === "vencimientos" ? estiloPestanaActiva : estiloPestanaInactiva}
          >
            Medicamentos por Vencer
          </button>
        </div>
      </div>

      {/* 📑 Contenido: Dashboard */}
      {pestanaActiva === "dashboard" && <DashboardMetricasPage />}

      {/* 📑 Contenido: Medicamentos por Vencer */}
      {pestanaActiva === "vencimientos" && (
        // ✅ TODO el contenido que va al PDF DENTRO de este div
        <div id="contenido-reporte-pdf" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Filtros — NO se incluyen en el PDF */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid #e2e8f0",
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#475569",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Horizonte de días
              </label>
              <select
                value={horizonteDias}
                onChange={(e) => setHorizonteDias(Number(e.target.value))}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              >
                {horizontesDisponibles.map((opt) => (
                  <option key={opt.valor} value={opt.valor}>
                    {opt.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#475569",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Comunidad
              </label>
              <select
                value={comunidadId}
                onChange={(e) => setComunidadId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              >
                <option value={valoresEspeciales.TODAS}>Todas las comunidades</option>
                {listaComunidades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#475569",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Bodega
              </label>
              <select
                value={bodegaId}
                onChange={(e) => setBodegaId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              >
                <option value={valoresEspeciales.TODAS}>Todas las bodegas</option>
                {listaBodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={recargar}
              style={{
                padding: "8px 16px",
                backgroundColor: "#f1f5f9",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                marginTop: "16px",
              }}
            >
              Actualizar
            </button>
          </div>

          {/* Total en riesgo — SÍ se incluye en el PDF */}
          <div
            style={{
              backgroundColor: "#fffbeb",
              borderRadius: "12px",
              padding: "14px 20px",
              border: "1px solid #fcd34d",
            }}
          >
            <span style={{ fontSize: "14px", color: "#b45309" }}>
              <strong>{totalUnidadesEnRiesgo.toLocaleString("es-GT")}</strong> unidades en riesgo de
              vencimiento
            </span>
          </div>

          {/* Tabla de resultados — SÍ se incluye en el PDF */}
          {cargando ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Cargando lotes próximos a vencer...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "20px",
                color: "#dc2626",
                backgroundColor: "#fef2f2",
                borderRadius: "8px",
              }}
            >
              Error al cargar: {error.mensaje || "Desconocido"}
            </div>
          ) : filas.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Ningún lote vence en los próximos {horizonteDias} días
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                      }}
                    >
                      Estado
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                      }}
                    >
                      Medicamento
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                      }}
                    >
                      Lote
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                      }}
                    >
                      Vencimiento
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                      }}
                    >
                      Días restantes
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                      }}
                    >
                      Cantidad
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                      }}
                    >
                      Bodega
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => {
                    const estilo = coloresAlerta[fila.alerta] || coloresAlerta.normal;
                    return (
                      <tr key={fila.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "500",
                              backgroundColor: estilo.fondo,
                              color: estilo.texto,
                              border: `1px solid ${estilo.borde}`,
                            }}
                          >
                            {etiquetasAlerta[fila.alerta]}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "14px" }}>
                          {fila.medicamento}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            fontSize: "14px",
                            fontFamily: "monospace",
                          }}
                        >
                          {fila.lote}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "14px" }}>
                          {fila.fechaVencimiento}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            fontSize: "14px",
                            fontWeight: 500,
                          }}
                        >
                          <strong>{fila.diasRestantes}</strong>
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        >
                          {fila.cantidad.toLocaleString("es-GT")}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                          {fila.bodega || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        // ✅ Fin del contenido PDF
      )}
    </div>
  );
}