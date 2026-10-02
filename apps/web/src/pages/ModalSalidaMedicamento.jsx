import { useRegistroSalida } from "@ecopac/shared";
import { useCerrarAlTocarFuera } from "../hooks/useCerrarAlTocarFuera";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import { EnFormulario } from "../components/contextoDeFormulario";

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
    claveLoteSeleccionado,
    seleccionarLotePorClave,
    cantidad,
    setCantidad,
    lotesDisponibles,
    sinExistencia,
    avisoCantidad,
    puedeGuardar,
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

        {/* Formulario. noValidate: lo que falta lo dice la pantalla y el boton no se habilita
            (issue #911); el aviso del navegador ("Please select an item in the list") salia en
            ingles y tapaba el texto de abajo. */}
        <form onSubmit={guardarSalida} noValidate style={{ padding: "24px" }}>
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
              {/* Las opciones se identifican por lote Y bodega (claveDeLoteDeSalida): un lote en
                  dos bodegas daba dos opciones con el mismo value. */}
              <select
                value={claveLoteSeleccionado}
                onChange={(e) => seleccionarLotePorClave(e.target.value)}
                disabled={sinExistencia}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                  backgroundColor: "var(--color-background)",
                }}
              >
                <option value="">
                  {sinExistencia ? "Sin existencia" : "Lote sugerido por orden de vencimiento..."}
                </option>
                {lotesDisponibles.map((lote) => (
                  <option
                    key={`${lote.loteId}|${lote.bodegaId}`}
                    value={`${lote.loteId}|${lote.bodegaId ?? ""}`}
                  >
                    Lote: {lote.numeroLote} - Bodega: {lote.bodega} - Vence:{" "}
                    {lote.fechaVencimiento ?? "no vence"} (Disp: {lote.cantidadDisponible})
                  </option>
                ))}
              </select>
              {/* Las tres causas posibles son las que excluye vista_lotes_disponibles (00047): el
                  unico ingreso del medicamento sigue pendiente de aprobacion (00107), sus lotes ya
                  vencieron, o ya no les queda existencia. */}
              {sinExistencia && !error && (
                <p
                  role="alert"
                  style={{
                    fontSize: "var(--texto-xs)",
                    color: "var(--color-danger)",
                    fontWeight: "var(--peso-bold)",
                    margin: "6px 0 0 0",
                  }}
                >
                  No hay existencia de este medicamento. Puede que su ingreso esté pendiente de
                  aprobación, que sus lotes ya vencieron, o que ya no quede.
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
                disabled={sinExistencia}
                aria-invalid={Boolean(avisoCantidad)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: avisoCantidad
                    ? "1px solid var(--color-danger)"
                    : "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                  backgroundColor: "var(--color-background)",
                  boxSizing: "border-box",
                }}
              />
              {avisoCantidad && (
                <p
                  role="alert"
                  style={{
                    fontSize: "var(--texto-xs)",
                    color: "var(--color-danger)",
                    margin: "6px 0 0 0",
                  }}
                >
                  {avisoCantidad}
                </p>
              )}
            </div>
          </div>

          <div className="ec-form-pie">
            <EnFormulario>
              <SecondaryButton title="Cancelar" onClick={onClose} disabled={cargando} />
              {/* Sin motivo, lote o una cantidad que alcance, no se habilita (issue #911). */}
              <PrimaryButton
                type="submit"
                title="Registrar salida"
                loading={cargando}
                disabled={!puedeGuardar}
              />
            </EnFormulario>
          </div>
        </form>
      </div>
    </div>
  );
}
