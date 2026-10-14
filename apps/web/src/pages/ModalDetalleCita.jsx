import { useState } from "react";
import { Ban, Pencil, Stethoscope, Undo2, X } from "lucide-react";

import { detalleDeCita, etiquetaDeEstadoDeCita } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import StatusChip from "../components/StatusChip";
import TextField from "../components/TextField";

// El detalle de una cita (issue #927): sus datos y lo que se puede hacer con ella. Que botones
// aparecen lo decide accionesDeCita() en shared; el cambio de estado, useCambioEstadoCita().
//
// Atender no abre la consulta aqui: avisa a quien lo monta, que pasa la cita a en atencion y abre
// el formulario de consulta de siempre con la cita.

export default function ModalDetalleCita({
  cita,
  acciones,
  enviando = false,
  error,
  errores = {},
  onClose,
  onAtender,
  onEditar,
  onRegresar,
  onCancelar,
  onVerPaciente,
}) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <Modal visible onClose={onClose} title="Cita">
      <p className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <StatusChip status={cita.estado} label={etiquetaDeEstadoDeCita(cita.estado)} />
        {cita.consultaId && <span className="ec-chip pac-chip--presente">Consulta registrada</span>}
      </p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      <dl className="row mb-0">
        {detalleDeCita(cita).map((campo) => (
          <div className="col-sm-6 mb-2" key={campo.id}>
            <dt className="pac-rotulo">{campo.label}</dt>
            <dd className="mb-0">{campo.valor}</dd>
          </div>
        ))}
      </dl>

      {cancelando ? (
        <div className="mt-3">
          <TextField
            label="Motivo de la cancelación (opcional)"
            as="textarea"
            rows={2}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            error={errores.motivo}
            disabled={enviando}
          />
          <div className="ec-form-pie">
            <SecondaryButton
              title="Volver"
              variant="neutra"
              onClick={() => setCancelando(false)}
              disabled={enviando}
              icon={<X size={16} aria-hidden="true" />}
            />
            <PrimaryButton
              title="Cancelar la cita"
              onClick={() => onCancelar(motivo)}
              loading={enviando}
              icon={<Ban size={16} aria-hidden="true" />}
            />
          </div>
        </div>
      ) : (
        <div className="ec-form-pie">
          {onVerPaciente && (
            <SecondaryButton title="Ver ficha" variant="neutra" onClick={onVerPaciente} />
          )}
          {acciones.cancelar && (
            <SecondaryButton
              title="Cancelar cita"
              variant="peligro"
              onClick={() => setCancelando(true)}
              disabled={enviando}
              icon={<Ban size={16} aria-hidden="true" />}
            />
          )}
          {acciones.regresar && (
            <SecondaryButton
              title="Regresar a creada"
              onClick={onRegresar}
              disabled={enviando}
              icon={<Undo2 size={16} aria-hidden="true" />}
            />
          )}
          {acciones.editar && (
            <SecondaryButton
              title="Editar"
              onClick={onEditar}
              disabled={enviando}
              icon={<Pencil size={16} aria-hidden="true" />}
            />
          )}
          {acciones.atender && (
            <PrimaryButton
              title="Atender"
              onClick={onAtender}
              loading={enviando}
              icon={<Stethoscope size={16} aria-hidden="true" />}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
