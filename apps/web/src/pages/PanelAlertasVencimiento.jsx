import { useState } from "react";
import { useAlertasVencimiento } from "../../../../packages/shared/inventario/useAlertasVencimiento.js";
import { OPCIONES_ACCION_ALERTA } from "../../../../packages/shared/inventario/campos.js";

export default function PanelAlertasVencimiento({
  lotes = [],
  bodegas = [],
  usuarioId,
  rolUsuario,
}) {
  const {
    porVencer,
    vencidas,
    cantidadPendientes,
    busqueda,
    setBusqueda,
    filtroBodega,
    setFiltroBodega,
    filtroCategoria,
    setFiltroCategoria,
    bodegasDisponibles,
    categoriasDisponibles,
    marcarComoAtendida,
  } = useAlertasVencimiento({ lotes, bodegas, usuarioId, rolUsuario });

  const [alertaAtendiendo, setAlertaAtendiendo] = useState(null);
  const [accionTomada, setAccionTomada] = useState("");

  const handleAtender = (alerta) => {
    setAlertaAtendiendo(alerta);
    setAccionTomada("");
  };

  const confirmarAtender = async () => {
    if (!alertaAtendiendo) return;
    try {
      await marcarComoAtendida(alertaAtendiendo.id, accionTomada);
      setAlertaAtendiendo(null);
      setAccionTomada("");
    } catch (error) {
      alert(error.message || "No se pudo registrar la acción");
    }
  };

  const formatoFecha = (fecha) => (fecha ? new Date(fecha).toLocaleDateString("es-GT") : "—");

  const estiloFila = (dias) => {
    if (dias < 0) return { fondo: "#fef2f2", borde: "#fecaca", texto: "#dc2626" };
    if (dias <= 30) return { fondo: "#f0fdf4", borde: "#bbf7d0", texto: "#16a34a" };
    return { fondo: "#fffbeb", borde: "#fde68a", texto: "#d97706" };
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* 📌 Cabecera */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: "700", margin: 0, color: "#0f172a" }}>
          Alertas de Vencimiento
        </h2>
        <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
          Medicamentos próximos a caducar (próximos 30 días)
        </p>
        <div style={{ marginTop: "8px", fontSize: "15px", color: "#475569" }}>
          {cantidadPendientes} pendientes
        </div>
      </div>

      {/* 🔍 Filtros */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "28px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Buscar medicamento o lote..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            padding: "8px 14px",
            border: "1px solid #e2e8f0",
            borderRadius: "4px",
            fontSize: "14px",
            minWidth: "240px",
            outline: "none",
          }}
        />
        <select
          value={filtroBodega}
          onChange={(e) => setFiltroBodega(e.target.value)}
          style={{
            padding: "8px 14px",
            border: "1px solid #e2e8f0",
            borderRadius: "4px",
            fontSize: "14px",
            backgroundColor: "#fff",
          }}
        >
          {bodegasDisponibles.map((b) => (
            <option key={b} value={b}>
              {b === "todas" ? "Todas las bodegas" : b}
            </option>
          ))}
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          style={{
            padding: "8px 14px",
            border: "1px solid #e2e8f0",
            borderRadius: "4px",
            fontSize: "14px",
            backgroundColor: "#fff",
          }}
        >
          {categoriasDisponibles.map((c) => (
            <option key={c} value={c}>
              {c === "todas" ? "Todas las categorías" : c}
            </option>
          ))}
        </select>
      </div>

      {/* ⏳ Próximos a vencer */}
      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 12px 0", color: "#0f172a" }}>
          Próximos a vencer ({porVencer.length})
        </h3>

        {porVencer.length === 0 ? (
          <div style={{ padding: "24px", color: "#64748b", fontSize: "14px" }}>
            No hay lotes por vencer en los próximos 30 días
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Medicamento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Lote
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Cantidad
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Vencimiento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Días restantes
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Bodega
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                >
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {porVencer.map((alerta) => {
                const estilo = estiloFila(alerta.diasRestantes);
                return (
                  <tr
                    key={alerta.id}
                    style={{ backgroundColor: estilo.fondo, borderBottom: "1px solid #e2e8f0" }}
                  >
                    <td style={{ padding: "14px 16px", fontSize: "14px" }}>{alerta.medicamento}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", fontFamily: "monospace" }}>
                      {alerta.lote}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: "14px",
                        textAlign: "right",
                        fontWeight: "500",
                      }}
                    >
                      {alerta.cantidad}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "14px" }}>
                      {formatoFecha(alerta.fechaVencimiento)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          backgroundColor: estilo.borde,
                          color: estilo.texto,
                          borderRadius: "4px",
                          fontWeight: "600",
                          fontSize: "14px",
                        }}
                      >
                        {alerta.diasRestantes === 0 ? "HOY" : `${alerta.diasRestantes}d`}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        textAlign: "center",
                        fontSize: "14px",
                        color: "#475569",
                      }}
                    >
                      {alerta.bodega}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <button
                        onClick={() => handleAtender(alerta)}
                        style={{
                          padding: "6px 16px",
                          backgroundColor: "#e2e8f0",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          fontSize: "13px",
                          fontWeight: "500",
                          cursor: "pointer",
                        }}
                      >
                        Atender
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ⚫ Vencidas */}
      <div>
        <h3 style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 12px 0", color: "#0f172a" }}>
          Vencidos — Para dar de baja ({vencidas.length})
        </h3>

        {vencidas.length === 0 ? (
          <div style={{ padding: "24px", color: "#64748b", fontSize: "14px" }}>
            No hay lotes vencidos
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #fecaca" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #fecaca" }}>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#dc2626",
                  }}
                >
                  Medicamento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#dc2626",
                  }}
                >
                  Lote
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#dc2626",
                  }}
                >
                  Cantidad
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#dc2626",
                  }}
                >
                  Vencimiento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#dc2626",
                  }}
                >
                  Días vencido
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#dc2626",
                  }}
                >
                  Bodega
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#dc2626",
                  }}
                >
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {vencidas.map((alerta) => (
                <tr
                  key={alerta.id}
                  style={{ backgroundColor: "#fef2f2", borderBottom: "1px solid #fecaca" }}
                >
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#991b1b" }}>
                    {alerta.medicamento}
                  </td>
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "14px",
                      fontFamily: "monospace",
                      color: "#991b1b",
                    }}
                  >
                    {alerta.lote}
                  </td>
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "14px",
                      textAlign: "right",
                      fontWeight: "500",
                      color: "#991b1b",
                    }}
                  >
                    {alerta.cantidad}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#991b1b" }}>
                    {formatoFecha(alerta.fechaVencimiento)}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        backgroundColor: "#fecaca",
                        color: "#dc2626",
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "14px",
                      }}
                    >
                      {Math.abs(alerta.diasRestantes)}d
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "14px 16px",
                      textAlign: "center",
                      fontSize: "14px",
                      color: "#b91c1c",
                    }}
                  >
                    {alerta.bodega}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => handleAtender(alerta)}
                      style={{
                        padding: "6px 16px",
                        backgroundColor: "#e2e8f0",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        fontSize: "13px",
                        fontWeight: "500",
                        cursor: "pointer",
                      }}
                    >
                      Registrar Baja
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 📋 Modal: Registrar acción */}
      {alertaAtendiendo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "420px",
              margin: "16px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 16px 0" }}>
              Registrar Acción Tomada
            </h3>
            <div style={{ marginBottom: "16px", fontSize: "14px", color: "#475569" }}>
              <p style={{ margin: "0 0 4px 0" }}>
                <strong>{alertaAtendiendo.medicamento}</strong>
              </p>
              <p style={{ margin: "0 0 4px 0" }}>Lote: {alertaAtendiendo.lote}</p>
              <p style={{ margin: 0 }}>
                Vencimiento: {formatoFecha(alertaAtendiendo.fechaVencimiento)}
              </p>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "6px",
                }}
              >
                Acción tomada <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                value={accionTomada}
                onChange={(e) => setAccionTomada(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                <option value="">-- Selecciona --</option>
                {OPCIONES_ACCION_ALERTA.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setAlertaAtendiendo(null)}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAtender}
                disabled={!accionTomada.trim()}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: "pointer",
                  opacity: accionTomada.trim() ? 1 : 0.6,
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
