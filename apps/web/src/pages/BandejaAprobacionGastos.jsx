import { useState } from "react";
import {
  formatearFechaCorta,
  formatearMoneda,
  usePendientesAprobacionGastos,
} from "@ecopac/shared";

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "../components";

// Pestaña "Aprobaciones" de PresupuestosPage.jsx (issue #304). No hay una pantalla web de #158
// que copiar (ver PLAN.md, seccion 5): se sigue la FORMA de ese hook -pendientes/conteo/
// cargando/error/recargar/aprobar/rechazar, con recarga tras cada accion exitosa-, replicada en
// usePendientesAprobacionGastos() para gastos.
//
// El ejecutado de proyectos/jornadas se actualiza "en la misma pantalla" (criterio 4) en el
// sentido de que useEjecucionPresupuestal() vuelve a pedir datos frescos la proxima vez que se
// monta o se recarga -aprobar()/rechazar() ya llaman a recargar() de esta bandeja tras exito-,
// sin Realtime ni polling (trampa 2 del plan). Esta bandeja en si no pinta el ejecutado: quien
// vuelve a la pestaña "Resumen" o "Gastos" ve numeros frescos porque ese hook los vuelve a pedir
// al montarse.
function TarjetaGastoPendiente({ gasto, catalogos, onAprobar, onPedirRechazo, procesando }) {
  const nombreDeRegistro =
    catalogos.perfiles.find((opcion) => opcion.value === gasto.registrado_por)?.label ||
    "Desconocido";

  return (
    <Card>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
        <span className="fw-bold">{gasto.concepto}</span>
        <span className="fw-bold">{formatearMoneda(gasto.monto)}</span>
      </div>
      <div className="small mb-2" style={{ color: "var(--color-text-muted)" }}>
        {gasto.jornadas?.proyectos?.nombre || "—"} · {gasto.jornadas?.nombre || "—"} ·{" "}
        {formatearFechaCorta(gasto.fecha)}
      </div>
      <div className="small mb-3" style={{ color: "var(--color-text-muted)" }}>
        Registrado por: {nombreDeRegistro}
      </div>
      <div className="d-flex justify-content-end gap-2">
        <SecondaryButton
          title="Rechazar"
          onClick={() => onPedirRechazo(gasto)}
          disabled={procesando}
        />
        <PrimaryButton title="Aprobar" onClick={() => onAprobar(gasto)} loading={procesando} />
      </div>
    </Card>
  );
}

function ModalRechazo({ gasto, onClose, onConfirmar, enviando }) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);

  const confirmar = async () => {
    if (!motivo.trim()) {
      setError("El motivo de rechazo es obligatorio.");
      return;
    }
    const respuesta = await onConfirmar(gasto.id, motivo);
    if (respuesta.error) {
      setError(respuesta.error.mensaje);
      return;
    }
    onClose();
  };

  return (
    <Modal visible onClose={onClose} title="Rechazar gasto">
      <p>
        {gasto.concepto} — {formatearMoneda(gasto.monto)}
      </p>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <TextField
        label="Motivo de rechazo"
        value={motivo}
        onChange={(evento) => {
          setMotivo(evento.target.value);
          setError(null);
        }}
        disabled={enviando}
      />
      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
        <PrimaryButton title="Rechazar gasto" onClick={confirmar} loading={enviando} />
      </div>
    </Modal>
  );
}

export default function BandejaAprobacionGastos({ usuarioId }) {
  const { pendientes, catalogos, cargando, error, recargar, aprobar, rechazar } =
    usePendientesAprobacionGastos({ usuarioId });

  const [gastoEnRechazo, setGastoEnRechazo] = useState(null);
  const [idProcesando, setIdProcesando] = useState(null);
  const [enviandoRechazo, setEnviandoRechazo] = useState(false);

  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;
  if (cargando) return <LoadingState />;

  if (pendientes.length === 0) {
    return <EmptyState message="No hay gastos pendientes de aprobacion." />;
  }

  const confirmarAprobacion = async (gasto) => {
    setIdProcesando(gasto.id);
    await aprobar(gasto.id);
    setIdProcesando(null);
  };

  const confirmarRechazo = async (gastoId, motivo) => {
    setEnviandoRechazo(true);
    const respuesta = await rechazar(gastoId, motivo);
    setEnviandoRechazo(false);
    return respuesta;
  };

  return (
    <div className="d-flex flex-column gap-3">
      {pendientes.map((gasto) => (
        <TarjetaGastoPendiente
          key={gasto.id}
          gasto={gasto}
          catalogos={catalogos}
          onAprobar={confirmarAprobacion}
          onPedirRechazo={setGastoEnRechazo}
          procesando={idProcesando === gasto.id}
        />
      ))}

      {gastoEnRechazo && (
        <ModalRechazo
          gasto={gastoEnRechazo}
          onClose={() => setGastoEnRechazo(null)}
          onConfirmar={confirmarRechazo}
          enviando={enviandoRechazo}
        />
      )}
    </div>
  );
}
