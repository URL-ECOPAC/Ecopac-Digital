import { CAMPOS_CORRECCION_CONSULTA, useCorreccionConsulta } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";

// Modal de correccion de una consulta ya registrada (issue #756, auditoria campo-a-vista).
//
// actualizarConsulta() y puedeCorregirConsulta() (packages/shared/pacientes/) ya existian,
// probados, desde antes de esta issue: solo faltaba una pantalla que los llamara. Se abre desde
// el evento de tipo consulta en PestaniaHistorialPaciente.jsx, no desde una pantalla de captura
// nueva: la captura sigue siendo movil (ConsultaScreen.js), esto es solo la correccion posterior.
//
// Sin diagnosticos: CAMPOS_CORRECCION_CONSULTA los excluye a proposito (ver campos.js), porque
// consulta_diagnostico no tiene ninguna politica RLS de UPDATE/DELETE todavia.
export default function ModalCorreccionConsulta({ consulta, onClose, onGuardado }) {
  const { valores, error, enviando, setCampo, guardar } = useCorreccionConsulta(consulta);

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.consulta);
  };

  return (
    <Modal visible onClose={onClose} title="Corregir consulta">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {CAMPOS_CORRECCION_CONSULTA.map((campo) => (
        <TextField
          key={campo.id}
          label={campo.label}
          as="textarea"
          rows={campo.id === "motivoConsulta" ? 2 : 3}
          value={valores[campo.id] ?? ""}
          onChange={(evento) => setCampo(campo.id, evento.target.value)}
          disabled={enviando}
        />
      ))}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
        <PrimaryButton title="Guardar" onClick={guardarCambios} loading={enviando} />
      </div>
    </Modal>
  );
}
