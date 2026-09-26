import { useState } from "react";

import {
  ETIQUETAS_TIPO_MOVIMIENTO,
  formatearFechaCorta,
  permisosDeMovimientos,
  usePendientesValidacion,
} from "@ecopac/shared";
import SectionHeader from "../components/SectionHeader";
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

  // El formato sale de shared, como en el resto de la app: toLocaleDateString depende del motor.
  const formatoFecha = (fechaIso) => formatearFechaCorta(fechaIso) || "—";

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
      }}
    >
      {/* Encabezado */}
      <SectionHeader
        title="Bandeja de validación de movimientos"
        subtitle={`${pendientes.length} pendientes por revisar y autorizar`}
      />

      {errorAccion && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
            border: "1px solid color-mix(in srgb, var(--color-danger) 25%, var(--color-surface))",
            color: "var(--color-danger)",
            fontSize: "var(--texto-xs)",
          }}
        >
          {errorAccion}
        </div>
      )}

      {/* Tabla / Lista de movimientos */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "20px",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--sombra-sm)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--texto-xs)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-background)",
                }}
              >
                <th
                  style={{
                    padding: "14px 20px",
                    fontSize: "var(--texto-xxs)",
                    fontWeight: "var(--peso-bold)",
                    color: "var(--color-text-muted)",
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
                    fontSize: "var(--texto-xxs)",
                    fontWeight: "var(--peso-bold)",
                    color: "var(--color-text-muted)",
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
                    fontSize: "var(--texto-xxs)",
                    fontWeight: "var(--peso-bold)",
                    color: "var(--color-text-muted)",
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
                    fontSize: "var(--texto-xxs)",
                    fontWeight: "var(--peso-bold)",
                    color: "var(--color-text-muted)",
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
                    fontSize: "var(--texto-xxs)",
                    fontWeight: "var(--peso-bold)",
                    color: "var(--color-text-muted)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "left",
                  }}
                >
                  Bodega
                </th>
                <th
                  style={{
                    padding: "14px 20px",
                    fontSize: "var(--texto-xxs)",
                    fontWeight: "var(--peso-bold)",
                    color: "var(--color-text-muted)",
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
                      fontSize: "var(--texto-xxs)",
                      fontWeight: "var(--peso-bold)",
                      color: "var(--color-text-muted)",
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
                      color: "var(--color-text-muted)",
                      fontSize: "var(--texto-sm)",
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
                      color: "var(--color-danger)",
                      fontSize: "var(--texto-sm)",
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
                      color: "var(--color-text-muted)",
                      fontSize: "var(--texto-sm)",
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
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    {/* Tipo */}
                    <td style={{ padding: "16px 20px", textAlign: "left" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          borderRadius: "9999px",
                          fontSize: "var(--texto-xxs)",
                          fontWeight: "var(--peso-bold)",
                          backgroundColor:
                            mov.tipo === "ingreso"
                              ? "color-mix(in srgb, var(--color-success) 18%, var(--color-surface))"
                              : "color-mix(in srgb, var(--color-warning) 18%, var(--color-surface))",
                          color:
                            mov.tipo === "ingreso"
                              ? "var(--color-success)"
                              : "var(--color-warning)",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {ETIQUETAS_TIPO_MOVIMIENTO[mov.tipo] ?? mov.tipo}
                      </span>
                    </td>

                    {/* Medicamento / Lote */}
                    <td style={{ padding: "16px 20px", textAlign: "left" }}>
                      <div
                        style={{ fontWeight: "var(--peso-semibold)", color: "var(--color-text)" }}
                      >
                        {mov.lote?.medicamento?.nombre || "—"}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--texto-xs)",
                          color: "var(--color-info)",
                          marginTop: "2px",
                        }}
                      >
                        Lote: {mov.lote?.numero_lote || "—"}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--texto-xxs)",
                          color: "var(--color-text-muted)",
                          marginTop: "4px",
                          fontFamily: "var(--fuente-mono)",
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
                        fontSize: "var(--texto-md)",
                        fontWeight: "var(--peso-bold)",
                        color: "var(--color-text)",
                      }}
                    >
                      {mov.cantidad}
                    </td>

                    {/* Registrado por */}
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--color-text)",
                        fontSize: "var(--texto-xs)",
                      }}
                    >
                      {[mov.registradoPor?.nombres, mov.registradoPor?.apellidos]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>

                    {/* Bodega */}
                    <td
                      style={{
                        padding: "16px 20px",
                        color: "var(--color-text)",
                        fontSize: "var(--texto-xs)",
                      }}
                    >
                      {mov.bodega?.nombre || "—"}
                    </td>

                    {/* Fecha */}
                    <td style={{ padding: "16px 20px", color: "var(--color-text)" }}>
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
                                backgroundColor: "var(--color-success)",
                                color: "var(--color-surface)",
                                fontSize: "var(--texto-xs)",
                                fontWeight: "var(--peso-bold)",
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
                                border: "1px solid var(--color-danger)",
                                backgroundColor: "var(--color-surface)",
                                color: "var(--color-danger)",
                                fontSize: "var(--texto-xs)",
                                fontWeight: "var(--peso-bold)",
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
