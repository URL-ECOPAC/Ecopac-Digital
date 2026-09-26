import { useRegistroSalida } from "@ecopac/shared";
import { useCerrarAlTocarFuera } from "../hooks/useCerrarAlTocarFuera";

export function ModalSalidaMedicamento({
  abierto,
  onClose,
  onExito,
  medicamentos = [],
  usuarioId,
}) {
  const {
    motivo,
    setMotivo,
    medicamentoId,
    setMedicamentoId,
    loteSeleccionado,
    seleccionarLote,
    cantidad,
    setCantidad,
    lotesDisponibles,
    error,
    cargando,
    guardarSalida,
  } = useRegistroSalida({
    usuarioId,
    // onExito (issue #859) faltaba: el modal se cerraba solo, sin avisarle al padre que recargara
    // lotesRaw/existenciasRaw. La salida SI descontaba el stock en la base -para administracion,
    // en el acto (fn_autoaprobar_movimiento_inventario); para medico y voluntario, al aprobarse-,
    // pero InventarioPage seguia mostrando los numeros de antes de abrir el modal hasta que
    // alguien recargara la pagina entera.
    onExito: (datos) => {
      if (onExito) onExito(datos);
      onClose();
    },
  });

  const fondo = useCerrarAlTocarFuera(onClose, { activo: abierto });

  if (!abierto) return null;

  return (
    <div
      {...fondo}
      style={{
        position: "fixed",
        inset: 0,
        background: "color-mix(in srgb, var(--color-text) 45%, transparent)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "560px",
          boxShadow: "var(--sombra-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "var(--texto-md)",
                fontWeight: "var(--peso-bold)",
                color: "var(--color-text)",
                margin: 0,
              }}
            >
              Registro de Salida de Medicamentos
            </h2>
            <p
              style={{
                fontSize: "var(--texto-xs)",
                color: "var(--color-text-muted)",
                margin: "2px 0 0 0",
              }}
            >
              Control de entrega, traslados y bajas con sugerencia FEFO
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "var(--texto-lg)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={guardarSalida} style={{ padding: "24px" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
                color: "var(--color-danger)",
                borderRadius: "10px",
                fontSize: "var(--texto-xs)",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Motivo de Salida */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: "var(--peso-bold)",
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}
              >
                Motivo de Salida *
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                  backgroundColor: "var(--color-background)",
                }}
              >
                <option value="">Seleccione motivo...</option>
                <option value="entrega">Entrega a paciente</option>
                <option value="traslado">Traslado entre bodegas</option>
                <option value="baja">Baja por vencimiento</option>
                <option value="donacion">Donación a terceros</option>
              </select>
            </div>

            {/* Selección de Medicamento */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: "var(--peso-bold)",
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}
              >
                Medicamento *
              </label>
              <select
                value={medicamentoId}
                onChange={(e) => setMedicamentoId(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                  backgroundColor: "var(--color-background)",
                }}
              >
                <option value="">Seleccione medicamento...</option>
                {medicamentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.concentracion})
                  </option>
                ))}
              </select>
            </div>

            {/* Lote Sugerido / Seleccionado (FEFO) */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: "var(--peso-bold)",
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}
              >
                Lote Sugerido (FEFO) *
              </label>
              <select
                value={loteSeleccionado?.loteId || ""}
                onChange={(e) => {
                  const loteEncontrado = lotesDisponibles.find((l) => l.loteId === e.target.value);
                  if (loteEncontrado) seleccionarLote(loteEncontrado);
                }}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                  backgroundColor: "var(--color-background)",
                }}
              >
                <option value="">Lote sugerido por orden de vencimiento...</option>
                {lotesDisponibles.map((lote) => (
                  <option key={lote.loteId} value={lote.loteId}>
                    Lote: {lote.numeroLote} - Bodega: {lote.bodega} - Vence: {lote.fechaVencimiento}{" "}
                    (Disp: {lote.cantidadDisponible})
                  </option>
                ))}
              </select>
              {/* Sin esto, un medicamento sin lotes en vista_lotes_disponibles (00047) se veia
                  igual que uno todavia sin elegir: la lista simplemente salia vacia, sin decir
                  por que. Las tres causas posibles son las que excluye esa vista: el unico
                  ingreso del medicamento sigue pendiente de aprobacion (no tiene existencias
                  todavia, 00107), sus lotes ya vencieron, o ya no les queda stock. */}
              {medicamentoId && !cargando && !error && lotesDisponibles.length === 0 && (
                <p
                  style={{
                    fontSize: "var(--texto-xs)",
                    color: "var(--color-text-muted)",
                    margin: "6px 0 0 0",
                  }}
                >
                  Este medicamento no tiene lotes disponibles para salida: puede que su ingreso esté
                  pendiente de aprobación, que sus lotes ya vencieron, o que no quede stock.
                </p>
              )}
            </div>

            {/* Cantidad */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: "var(--peso-bold)",
                  color: "var(--color-text)",
                  marginBottom: "6px",
                }}
              >
                Cantidad a Retirar *
              </label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                  backgroundColor: "var(--color-background)",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Botones */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: "9999px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-muted)",
                fontSize: "var(--texto-xs)",
                fontWeight: "var(--peso-bold)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              style={{
                padding: "10px 24px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "var(--color-primary)",
                color: "var(--color-surface)",
                fontSize: "var(--texto-xs)",
                fontWeight: "var(--peso-bold)",
                cursor: "pointer",
              }}
            >
              {cargando ? "Registrando..." : "Registrar Salida"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
