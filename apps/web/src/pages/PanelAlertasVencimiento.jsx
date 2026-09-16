import { useState } from "react";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import { OPCIONES_ACCION_ALERTA, useAlertasVencimiento } from "@ecopac/shared";

export default function PanelAlertasVencimiento({ usuarioId, rolUsuario }) {
  const {
    porVencer,
    vencidas,
    cantidadPendientes,
    cargando,
    error,
    recargar,
    busqueda,
    setBusqueda,
    marcarComoAtendida,
  } = useAlertasVencimiento({ usuarioId, rolUsuario });

  const [alertaAtendiendo, setAlertaAtendiendo] = useState(null);
  const [accionTomada, setAccionTomada] = useState("");
  // El fallo se muestra dentro del modal, junto al boton que lo provoco, en vez de en un alert()
  // del navegador que tapa la pantalla y se lleva el contexto al cerrarse (issue #762).
  const [errorAtender, setErrorAtender] = useState(null);

  const handleAtender = (alerta) => {
    setAlertaAtendiendo(alerta);
    setAccionTomada("");
    setErrorAtender(null);
  };

  const confirmarAtender = async () => {
    if (!alertaAtendiendo) return;
    setErrorAtender(null);
    try {
      await marcarComoAtendida(alertaAtendiendo.id, accionTomada);
      setAlertaAtendiendo(null);
      setAccionTomada("");
    } catch (error) {
      setErrorAtender(error.message || "No se pudo registrar la acción");
    }
  };

  const formatoFecha = (fecha) => (fecha ? new Date(fecha).toLocaleDateString("es-GT") : "—");

  // Los tres niveles de urgencia, tenidos a partir del color de estado que les corresponde en
  // vez de con seis hexadecimales sueltos: vencido es el color de peligro, dentro de 30 dias el
  // de exito, y el resto la advertencia. color-mix da el fondo palido y el borde a partir del
  // mismo color, asi que cambiar la paleta en @ecopac/ui-tokens los mueve a los tres.
  const estiloFila = (dias) => {
    const color =
      dias < 0
        ? "var(--color-danger)"
        : dias <= 30
          ? "var(--color-success)"
          : "var(--color-warning)";

    return {
      fondo: `color-mix(in srgb, ${color} 8%, var(--color-surface))`,
      borde: `color-mix(in srgb, ${color} 28%, var(--color-surface))`,
      texto: color,
    };
  };

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  return (
    // Sin fontFamily propia. Este <div> declaraba "system-ui, -apple-system, sans-serif" a mano:
    // una pila parecida a la del sistema pero NO la misma -le faltan BlinkMacSystemFont, Segoe UI
    // y Roboto, que son las que de hecho se usan en Windows y Android-, asi que el panel de
    // alertas se dibujaba con una letra distinta de la del resto de la aplicacion. La familia la
    // hereda del <body>, que la toma de --fuente-base (theme.js, desde @ecopac/ui-tokens).
    <div>
      {/* Cabecera */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <h2
          style={{
            fontSize: "var(--texto-xxl)",
            fontWeight: "var(--peso-bold)",
            margin: 0,
            color: "var(--color-text)",
          }}
        >
          Alertas de Vencimiento
        </h2>
        <p
          style={{
            fontSize: "var(--texto-sm)",
            color: "var(--color-text-muted)",
            margin: "var(--spacing-xs) 0 0 0",
          }}
        >
          Medicamentos próximos a caducar (próximos 30 días)
        </p>
        <div
          style={{
            marginTop: "var(--spacing-sm)",
            fontSize: "var(--texto-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          {cantidadPendientes} pendientes
        </div>
      </div>

      {/* Filtro */}
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
            fontSize: "var(--texto-sm)",
            minWidth: "240px",
            outline: "none",
          }}
        />
      </div>

      {/* Próximos a vencer */}
      <div style={{ marginBottom: "32px" }}>
        <h3
          style={{
            fontSize: "var(--texto-lg)",
            fontWeight: "var(--peso-semibold)",
            margin: "0 0 12px 0",
            color: "#0f172a",
          }}
        >
          Próximos a vencer ({porVencer.length})
        </h3>

        {porVencer.length === 0 ? (
          <div style={{ padding: "24px", color: "#64748b", fontSize: "var(--texto-sm)" }}>
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
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#0f172a",
                  }}
                >
                  Medicamento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#0f172a",
                  }}
                >
                  Lote
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#0f172a",
                  }}
                >
                  Cantidad afectada
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#0f172a",
                  }}
                >
                  Vencimiento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#0f172a",
                  }}
                >
                  Días restantes
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
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
                    <td style={{ padding: "14px 16px", fontSize: "var(--texto-sm)" }}>
                      {alerta.medicamento}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: "var(--texto-sm)",
                        fontFamily: "var(--fuente-mono)",
                      }}
                    >
                      {alerta.numeroLote}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: "var(--texto-sm)",
                        textAlign: "right",
                        fontWeight: "var(--peso-medium)",
                      }}
                    >
                      {alerta.cantidadAfectada}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "var(--texto-sm)" }}>
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
                          fontWeight: "var(--peso-semibold)",
                          fontSize: "var(--texto-sm)",
                        }}
                      >
                        {alerta.diasRestantes === 0 ? "HOY" : `${alerta.diasRestantes}d`}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <button
                        onClick={() => handleAtender(alerta)}
                        style={{
                          padding: "6px 16px",
                          backgroundColor: "#e2e8f0",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          fontSize: "var(--texto-xs)",
                          fontWeight: "var(--peso-medium)",
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

      {/* Vencidas */}
      <div>
        <h3
          style={{
            fontSize: "var(--texto-lg)",
            fontWeight: "var(--peso-semibold)",
            margin: "0 0 12px 0",
            color: "#0f172a",
          }}
        >
          Vencidos — Para dar de baja ({vencidas.length})
        </h3>

        {vencidas.length === 0 ? (
          <div style={{ padding: "24px", color: "#64748b", fontSize: "var(--texto-sm)" }}>
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
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#dc2626",
                  }}
                >
                  Medicamento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#dc2626",
                  }}
                >
                  Lote
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#dc2626",
                  }}
                >
                  Cantidad afectada
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#dc2626",
                  }}
                >
                  Vencimiento
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
                    color: "#dc2626",
                  }}
                >
                  Días vencido
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: "var(--texto-sm)",
                    fontWeight: "var(--peso-semibold)",
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
                  <td
                    style={{ padding: "14px 16px", fontSize: "var(--texto-sm)", color: "#991b1b" }}
                  >
                    {alerta.medicamento}
                  </td>
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "var(--texto-sm)",
                      fontFamily: "var(--fuente-mono)",
                      color: "#991b1b",
                    }}
                  >
                    {alerta.numeroLote}
                  </td>
                  <td
                    style={{
                      padding: "14px 16px",
                      fontSize: "var(--texto-sm)",
                      textAlign: "right",
                      fontWeight: "var(--peso-medium)",
                      color: "#991b1b",
                    }}
                  >
                    {alerta.cantidadAfectada}
                  </td>
                  <td
                    style={{ padding: "14px 16px", fontSize: "var(--texto-sm)", color: "#991b1b" }}
                  >
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
                        fontWeight: "var(--peso-semibold)",
                        fontSize: "var(--texto-sm)",
                      }}
                    >
                      {Math.abs(alerta.diasRestantes)}d
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => handleAtender(alerta)}
                      style={{
                        padding: "6px 16px",
                        backgroundColor: "#e2e8f0",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        fontSize: "var(--texto-xs)",
                        fontWeight: "var(--peso-medium)",
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

      {/* Modal: Registrar acción */}
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
            <h3
              style={{
                fontSize: "var(--texto-md)",
                fontWeight: "var(--peso-semibold)",
                margin: "0 0 16px 0",
              }}
            >
              Registrar Acción Tomada
            </h3>

            {errorAtender && <ErrorState message={errorAtender} />}
            <div style={{ marginBottom: "16px", fontSize: "var(--texto-sm)", color: "#475569" }}>
              <p style={{ margin: "0 0 4px 0" }}>
                <strong>{alertaAtendiendo.medicamento}</strong>
              </p>
              <p style={{ margin: "0 0 4px 0" }}>Lote: {alertaAtendiendo.numeroLote}</p>
              <p style={{ margin: 0 }}>
                Vencimiento: {formatoFecha(alertaAtendiendo.fechaVencimiento)}
              </p>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-sm)",
                  fontWeight: "var(--peso-medium)",
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
                  fontSize: "var(--texto-sm)",
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
                onClick={() => {
                  setAlertaAtendiendo(null);
                  setErrorAtender(null);
                }}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  fontSize: "var(--texto-sm)",
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
                  fontSize: "var(--texto-sm)",
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
