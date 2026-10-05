import { X } from "lucide-react";
import { useState } from "react";

import {
  agruparPendientesDeValidacion,
  avisoDeRechazoDeEntregaDeReceta,
  ETIQUETAS_TIPO_MOVIMIENTO,
  etiquetaDeMotivoDeMovimiento,
  formatearFechaCorta,
  permisosDeMovimientos,
  usePendientesValidacion,
} from "@ecopac/shared";
import { Modal, PrimaryButton, SecondaryButton, TextField } from "../components";
import SectionHeader from "../components/SectionHeader";

// El motivo del rechazo se pedia con prompt() del navegador: sin estilo, sin validar y bloqueante
// (issue #925). Mismo dialogo que el rechazo de gastos (BandejaAprobacionGastos.jsx).
function ModalRechazoDeMovimiento({ movimiento, onClose, onConfirmar, enviando }) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);
  const avisoDeReceta = avisoDeRechazoDeEntregaDeReceta(movimiento);

  const confirmar = async () => {
    if (!motivo.trim()) {
      setError("El motivo de rechazo es obligatorio.");
      return;
    }
    const { error: fallo } = await onConfirmar(movimiento, motivo.trim());
    if (fallo) {
      setError(fallo.mensaje);
      return;
    }
    onClose();
  };

  return (
    <Modal visible onClose={onClose} title="Rechazar movimiento">
      <p>
        {ETIQUETAS_TIPO_MOVIMIENTO[movimiento.tipo] ?? movimiento.tipo} de {movimiento.cantidad} ·{" "}
        {movimiento.lote?.medicamento?.nombre || "—"} · Lote {movimiento.lote?.numero_lote || "—"}
      </p>
      {avisoDeReceta && (
        <div className="alert alert-warning py-2 px-3 small" role="status">
          {avisoDeReceta}
        </div>
      )}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <TextField
        label="Motivo de rechazo"
        requerido
        value={motivo}
        onChange={(evento) => {
          setMotivo(evento.target.value);
          setError(null);
        }}
        disabled={enviando}
      />
      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton
          title="Cancelar"
          onClick={onClose}
          disabled={enviando}
          icon={<X size={16} aria-hidden="true" />}
        />
        <PrimaryButton title="Rechazar movimiento" onClick={confirmar} loading={enviando} />
      </div>
    </Modal>
  );
}
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
  const [porRechazar, setPorRechazar] = useState(null);
  // La entrega de una receta es una sola fila (issue #925): se aprueba o se rechaza completa.
  const filas = agruparPendientesDeValidacion(pendientes);

  // El formato sale de shared, como en el resto de la app: toLocaleDateString depende del motor.
  const formatoFecha = (fechaIso) => formatearFechaCorta(fechaIso) || "—";

  const handleAprobar = async (movimiento) => {
    setProcesandoId(movimiento.id);
    setErrorAccion(null);

    const respuesta = await aprobar(movimiento.id);
    if (respuesta.error) setErrorAccion(respuesta.error.mensaje);

    setProcesandoId(null);
  };

  const handleRechazar = (movimiento) => {
    setErrorAccion(null);
    setPorRechazar(movimiento);
  };

  const confirmarRechazo = async (movimiento, motivo) => {
    setProcesandoId(movimiento.id);
    const respuesta = await rechazar(movimiento.id, motivo);
    setProcesandoId(null);
    return { error: respuesta?.error ?? null };
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
        subtitle={`${filas.length} pendientes por revisar y autorizar`}
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
                filas.map(({ clave, esEntregaDeReceta, folio, movimiento: mov, movimientos }) => (
                  <tr
                    key={clave}
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
                        {esEntregaDeReceta
                          ? "Receta"
                          : (ETIQUETAS_TIPO_MOVIMIENTO[mov.tipo] ?? mov.tipo)}
                      </span>
                    </td>

                    {/* Medicamento / Lote */}
                    <td style={{ padding: "16px 20px", textAlign: "left" }}>
                      {esEntregaDeReceta && (
                        <div style={{ fontWeight: "var(--peso-bold)", color: "var(--color-text)" }}>
                          Receta {folio ?? ""}
                        </div>
                      )}
                      {movimientos.map((renglon) => (
                        <div key={renglon.id} style={{ marginTop: esEntregaDeReceta ? "4px" : 0 }}>
                          <div
                            style={{
                              fontWeight: "var(--peso-semibold)",
                              color: "var(--color-text)",
                            }}
                          >
                            {renglon.lote?.medicamento?.nombre || "—"}
                            {esEntregaDeReceta && ` · ${renglon.cantidad}`}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--texto-xs)",
                              color: "var(--color-info)",
                              marginTop: "2px",
                            }}
                          >
                            Lote: {renglon.lote?.numero_lote || "—"}
                          </div>
                        </div>
                      ))}
                      {/* El motivo dice de donde viene ("Entrega por receta medica REC-..."): antes
                          se mostraba el id del movimiento, que no le dice nada a quien aprueba. */}
                      <div
                        style={{
                          fontSize: "var(--texto-xs)",
                          color: "var(--color-text-muted)",
                          marginTop: "4px",
                        }}
                      >
                        {esEntregaDeReceta
                          ? "Se aprueba o se rechaza completa"
                          : etiquetaDeMotivoDeMovimiento(mov.motivo) || "Sin motivo"}
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
                      {esEntregaDeReceta ? `${movimientos.length} artículo(s)` : mov.cantidad}
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
                              {esEntregaDeReceta ? "Aprobar receta" : "Aprobar"}
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
                              {esEntregaDeReceta ? "Rechazar receta" : "Rechazar"}
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

      {porRechazar && (
        <ModalRechazoDeMovimiento
          movimiento={porRechazar}
          onClose={() => setPorRechazar(null)}
          onConfirmar={confirmarRechazo}
          enviando={procesandoId === porRechazar.id}
        />
      )}
    </div>
  );
}
