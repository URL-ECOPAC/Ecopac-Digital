import { CAMPOS_CORRECCION_CONSULTA, useCorreccionConsulta } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

// Modal de correccion de una consulta ya registrada (issue #756, auditoria campo-a-vista).
//
// actualizarConsulta() y puedeCorregirConsulta() (packages/shared/pacientes/) ya existian,
// probados, desde antes de esta issue: solo faltaba una pantalla que los llamara. Se abre desde
// el evento de tipo consulta en PestaniaHistorialPaciente.jsx, no desde una pantalla de captura
// nueva: la captura sigue siendo movil (ConsultaScreen.js), esto es solo la correccion posterior.
//
// Los diagnosticos no van en CAMPOS_CORRECCION_CONSULTA -no son un campo de `consultas`, y no son
// un campo plano: se quitan/agregan uno a la vez (migracion 00127, que le dio a
// consulta_diagnostico su primera politica de DELETE).
export default function ModalCorreccionConsulta({ consulta, onClose, onGuardado }) {
  const {
    valores,
    error,
    enviando,
    setCampo,
    guardar,
    diagnosticos,
    catalogoDiagnosticos,
    diagnosticoNuevo,
    setDiagnosticoNuevo,
    errorDiagnostico,
    quitarDiagnostico,
    agregarDiagnostico,
  } = useCorreccionConsulta(consulta);

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

      <hr />
      <h3 className="h6">Diagnosticos</h3>

      {errorDiagnostico && (
        <div className="alert alert-danger" role="alert">
          {errorDiagnostico.mensaje}
        </div>
      )}

      {diagnosticos.length === 0 ? (
        <p className="small text-body-secondary">Sin diagnosticos registrados.</p>
      ) : (
        <ul className="list-unstyled d-flex flex-column gap-1">
          {diagnosticos.map((diagnostico) => (
            <li
              key={diagnostico.vinculoId ?? diagnostico.id}
              className="d-flex align-items-center gap-2"
            >
              <span className="small">
                {diagnostico.nombre}
                {diagnostico.esPrincipal ? " (principal)" : ""}
              </span>
              <SecondaryButton
                title="Quitar"
                onClick={() => quitarDiagnostico(diagnostico.vinculoId)}
                disabled={enviando || !diagnostico.vinculoId}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="d-flex align-items-end gap-2">
        <Selector
          label="Agregar diagnostico"
          value={diagnosticoNuevo}
          options={catalogoDiagnosticos}
          onSelect={setDiagnosticoNuevo}
          disabled={enviando}
        />
        <SecondaryButton
          title="Agregar"
          onClick={agregarDiagnostico}
          disabled={enviando || !diagnosticoNuevo}
        />
      </div>

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
        <PrimaryButton title="Guardar" onClick={guardarCambios} loading={enviando} />
      </div>
    </Modal>
  );
}
