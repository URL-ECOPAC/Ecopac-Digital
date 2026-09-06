import { useState } from "react";

import { usePendientesValidacion } from "../../../../packages/shared/inventario/usePendientesValidacion.js";
import { permisosDeMovimientos } from "../../../../packages/shared/inventario/permisos.js";

// issue #689: esta pantalla tenia su propio movimientosPendientes escrito a mano (un solo
// movimiento de mentira) y handleAprobar/handleRechazar solo hacian console.log. Nunca llamaba
// a usePendientesValidacion(), que ya existia y estaba probada. Ahora la bandeja se autoabastece
// -mismo patron que BandejaAprobacionGastos.jsx para presupuestos-: recibe usuarioId/rolUsuario
// de InventarioPage.jsx y pide sus propios datos.
//
// Los botones de aprobar/rechazar se dibujan con permisosDeMovimientos(rolUsuario)
// (puedeAprobar/puedeRechazar), no con la presencia del prop: alguien sin el rol puede llegar a
// ver la bandeja (la pestana no se oculta) pero no debe ver botones que el servidor va a
// rechazar de todas formas.
export default function BandejaValidacionPage({ usuarioId, rolUsuario }) {
  const { pendientes, cargando, error, aprobar, rechazar } = usePendientesValidacion({
    usuarioId,
    rolUsuario,
  });
  const { puedeAprobar, puedeRechazar } = permisosDeMovimientos(rolUsuario);

  const [procesandoId, setProcesandoId] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);

  const formatoFecha = (fechaIso) => {
    if (!fechaIso) return "—";
    return new Date(fechaIso).toLocaleDateString("es-GT");
  };

  const handleAprobar = async (movimiento) => {
    setProcesandoId(movimiento.id);
    setErrorAccion(null);

    const respuesta = await aprobar(movimiento.id);
    if (respuesta.error) setErrorAccion(respuesta.error.mensaje);

    setProcesandoId(null);
  };

  const handleRechazar = async (movimiento) => {
    const motivo = prompt("Motivo del rechazo:");
    if (!motivo) return;

    setProcesandoId(movimiento.id);
    setErrorAccion(null);

    const respuesta = await rechazar(movimiento.id, motivo);
    if (respuesta.error) setErrorAccion(respuesta.error.mensaje);

    setProcesandoId(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "24px 0",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Encabezado */}
      <div>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "800",
            color: "#1e293b",
            margin: "0 0 4px 0",
          }}
        >
          Bandeja de Validación de Movimientos
        </h2>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
          {pendientes.length} Pendientes por revisar y autorizar
        </p>
      </div>

      {errorAccion && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: "13px",
          }}
        >
          {errorAccion}
        </div>
      )}

      {/* Tabla / Lista de movimientos */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #f1f5f9",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  backgroundColor: "#fafafa",
                }}
              >
                <th
                  style={{
                    padding: "14px 20px",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#64748b",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "left",
                  }}
                >
                  Tipo
                </th>
                <th
                  style={{
                    padding: "14px 20px",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#64748b",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "left",
                  }}
                >
                  Medicamento / Lote
                </th>
                <th
                  style={{
                    padding: "14px 20px",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#64748b",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  Cantidad
                </th>
                <th
                  style={{
                    padding: "14px 20px",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#64748b",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "left",
                  }}
                >
                  Registrado por
                </th>
                <th
                  style={{
                    padding: "14px 20px",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#64748b",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "left",
                  }}
                >
                  Fecha
                </th>
                {(puedeAprobar || puedeRechazar) && (
                  <th
                    style={{
                      padding: "14px 20px",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#64748b",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      textAlign: "center",
                    }}
                  >
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: "14px",
                    }}
                  >
                    Cargando movimientos pendientes...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "#dc2626",
                      fontSize: "14px",
                    }}
                  >
                    {error.mensaje}
                  </td>
                </tr>
              ) : pendientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: "14px",
                    }}
                  >
                    No hay movimientos pendientes de validación
                  </td>
                </tr>
              ) : (
                pendientes.map((mov) => (
                  <tr
                    key={mov.id}
                    style={{
                      borderBottom: "1px solid #f8fafc",
                    }}
                  >
                    {/* Tipo */}
                    <td style={{ padding: "16px 20px", textAlign: "left" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          borderRadius: "9999px",
                          fontSize: "11px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          backgroundColor: mov.tipo === "ingreso" ? "#d1fae5" : "#fef3c7",
                          color: mov.tipo === "ingreso" ? "#065f46" : "#78350f",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {mov.tipo}
                      </span>
                    </td>

                    {/* Medicamento / Lote */}
                    <td style={{ padding: "16px 20px", textAlign: "left" }}>
                      <div style={{ fontWeight: "600", color: "#1e293b" }}>
                        {mov.lote?.medicamento?.nombre || "—"}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#0284c7",
                          marginTop: "2px",
                        }}
                      >
                        Lote: {mov.lote?.numero_lote || "—"}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginTop: "4px",
                          fontFamily: "monospace",
                        }}
                      >
                        {mov.id}
                      </div>
                    </td>

                    {/* Cantidad */}
                    <td
                      style={{
                        padding: "16px 20px",
                        textAlign: "center",
                        fontSize: "18px",
                        fontWeight: "800",
                        color: "#0f172a",
                      }}
                    >
                      {mov.cantidad}
                    </td>

                    {/* Registrado por */}
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "#475569",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}
                    >
                      {mov.registrado_por}
                    </td>

                    {/* Fecha */}
                    <td style={{ padding: "16px 20px", color: "#475569" }}>
                      {formatoFecha(mov.created_at)}
                    </td>

                    {/* Acciones */}
                    {(puedeAprobar || puedeRechazar) && (
                      <td
                        style={{
                          padding: "16px 20px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "center",
                          }}
                        >
                          {puedeAprobar && (
                            <button
                              onClick={() => handleAprobar(mov)}
                              disabled={procesandoId === mov.id}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                backgroundColor: "#059669",
                                color: "#ffffff",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: procesandoId === mov.id ? "not-allowed" : "pointer",
                                opacity: procesandoId === mov.id ? 0.6 : 1,
                                transition: "all 0.15s ease",
                              }}
                            >
                              Aprobar
                            </button>
                          )}
                          {puedeRechazar && (
                            <button
                              onClick={() => handleRechazar(mov)}
                              disabled={procesandoId === mov.id}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "1px solid #ef4444",
                                backgroundColor: "#ffffff",
                                color: "#dc2626",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: procesandoId === mov.id ? "not-allowed" : "pointer",
                                opacity: procesandoId === mov.id ? 0.6 : 1,
                                transition: "all 0.15s ease",
                              }}
                            >
                              Rechazar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
