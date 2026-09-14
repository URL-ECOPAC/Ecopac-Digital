import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { typography } from "@ecopac/ui-tokens";
import DashboardMetricasPage from "./DashboardMetricasPage";
import {
  ETIQUETAS_NIVEL_ALERTA_VENCIMIENTO,
  useExportarPDF,
  useReporteMedicamentosPorVencer,
} from "@ecopac/shared";
import BotonExportarPDF from "../components/BotonExportarPDF";
import StatusChip from "../components/StatusChip";

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
// Pestaña nueva (issue #757, criterio 4): a diferencia de las dos de arriba, que son estilos
// preexistentes con hex a mano, esta usa @ecopac/ui-tokens. Por eso el color y el peso no son
// identicos a sus hermanas -- son la evidencia de que las pestañas viejas deberian migrar a
// tokens (issue #700), no una libertad visual de esta pestaña.
const estiloPestanaEnlace = {
  padding: "10px 18px",
  fontSize: typography.sizes.sm,
  fontWeight: typography.weights.medium,
  border: "none",
  background: "none",
  cursor: "pointer",
  borderBottom: "2px solid transparent",
  color: "var(--color-text-muted)",
  textDecoration: "none",
};

export default function ReportesPage() {
  const navigate = useNavigate();
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

  // Exportación PDF — issue #216
  const periodo = `Próximos ${horizonteDias} días`;
  const { exportar, generando } = useExportarPDF({
    tituloReporte: "Reporte de Medicamentos Próximos a Vencer",
    periodo,
  });

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* Cabecera */}
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
            {/* Botón PDF — SOLO visible en la pestaña de vencimientos */}
            {pestanaActiva === "vencimientos" && (
              <BotonExportarPDF onClick={exportar} generando={generando} />
            )}
          </div>
        </div>

        {/* Pestañas */}
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
          {/* Issue #757, criterio 4: antes vivia como Link en la cabecera, separado de las
              otras dos pestañas. Navega en vez de alternar pestanaActiva porque es una
              pagina aparte (ReportePacientesPage.jsx), no un estado de esta pantalla. */}
          <button onClick={() => navigate("/reportes/pacientes-atendidos")} style={estiloPestanaEnlace}>
            Pacientes atendidos
          </button>
        </div>
      </div>

      {/* Contenido: Dashboard */}
      {pestanaActiva === "dashboard" && <DashboardMetricasPage />}

      {/* Contenido: Medicamentos por Vencer */}
      {pestanaActiva === "vencimientos" && (
        // TODO el contenido que va al PDF DENTRO de este div
        <div
          id="contenido-reporte-pdf"
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
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
                    return (
                      <tr key={fila.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 16px" }}>
                          {/* El nivel sale de enums.js y el color de statusColors, via StatusChip
                              (issue #700). Antes la etiqueta llevaba un circulo de color dentro
                              del propio texto, y ese circulo era el unico portador del nivel
                              ademas de la palabra: un lector de pantalla no lo lee. El color
                              estaba ademas escrito a mano en esta pagina. */}
                          <StatusChip
                            status={fila.alerta}
                            label={ETIQUETAS_NIVEL_ALERTA_VENCIMIENTO[fila.alerta]}
                          />
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "14px" }}>
                          {fila.medicamento}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            fontSize: "14px",
                            fontFamily: "var(--fuente-mono)",
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
        // Fin del contenido PDF
      )}
    </div>
  );
}
