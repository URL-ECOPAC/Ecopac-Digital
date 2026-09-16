import { CAMPOS_TRIAJE, useCorreccionTriaje } from "@ecopac/shared";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";

// Modal de correccion de un triaje ya registrado (issue #756, auditoria campo-a-vista).
//
// actualizarTriaje() y puedeCorregirTriaje() (packages/shared/pacientes/) ya existian, probados,
// desde antes de esta issue: solo faltaba una pantalla que los llamara. Se abre desde el evento
// de tipo triaje en PestaniaHistorialPaciente.jsx -donde el medico ya revisa el historial
// clinico-, no desde una pantalla nueva de captura: la captura sigue siendo movil
// (TriajeScreen.js), esto es solo la correccion posterior.
//
// Mismo patron que ModalJornada.jsx: campos por CAMPOS_TRIAJE (packages/shared/pacientes/campos.js,
// los mismos siete que ya usa el registro movil), todos NumberField porque los siete son
// numericos.
export default function ModalCorreccionTriaje({ triaje, onClose, onGuardado }) {
  const { valores, errores, error, enviando, setCampo, guardar } = useCorreccionTriaje(triaje);

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.triaje);
  };

  return (
    <Modal visible onClose={onClose} title="Corregir triaje">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {CAMPOS_TRIAJE.map((campo) => (
        <NumberField
          key={campo.id}
          label={campo.label}
          value={valores[campo.id] ?? null}
          suffix={campo.sufijo}
          min={campo.validacion?.min}
          max={campo.validacion?.max}
          onChange={(valor) => setCampo(campo.id, valor)}
          error={errores[campo.id]}
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
