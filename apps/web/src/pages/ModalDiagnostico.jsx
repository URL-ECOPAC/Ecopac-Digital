import { TIPOS_DE_CAMPO, useFormularioDiagnostico } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";

// Modal de alta y edicion del catalogo de diagnosticos (issue #639), montado desde
// CatalogoDiagnosticosPage.jsx con estado local: no tiene ruta propia, mismo patron que
// ModalAltaUsuario.jsx.
//
// `diagnostico` decide el modo: null es alta, un objeto con id es edicion. El boton de
// retirar/reactivar solo aparece en edicion y llama a `onAlternarActivo`, que la pantalla
// resuelve con alternarActivo() de useCatalogoDiagnosticos.js -- no toca actualizarDiagnostico(),
// que solo conoce codigo/nombre/descripcion (ver catalogoDiagnosticos.campos.js).
export default function ModalDiagnostico({
  visible,
  diagnostico,
  onClose,
  onGuardado,
  onAlternarActivo,
}) {
  const { campos, valores, error, enviando, editando, setCampo, enviar } =
    useFormularioDiagnostico(diagnostico);

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onGuardado?.(resultado.diagnostico);
      onClose?.();
    }
  };

  const alternarActivo = async () => {
    const resultado = await onAlternarActivo?.(diagnostico);
    if (resultado?.ok) onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar diagnostico" : "Nuevo diagnostico"}
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {campos.map((campo) => (
        <TextField
          key={campo.id}
          label={campo.label}
          as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
          rows={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 3 : undefined}
          placeholder={campo.placeholder}
          maxLength={campo.validacion?.maxLongitud}
          value={valores[campo.id] ?? ""}
          onChange={(evento) => setCampo(campo.id, evento.target.value)}
        />
      ))}

      <div className="d-flex justify-content-between align-items-center mt-3">
        <div>
          {editando && (
            <SecondaryButton
              title={diagnostico.activo ? "Retirar" : "Reactivar"}
              onClick={alternarActivo}
              disabled={enviando}
            />
          )}
        </div>
        <div className="d-flex gap-2">
          <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
          <PrimaryButton
            title={editando ? "Guardar cambios" : "Crear"}
            onClick={guardar}
            loading={enviando}
          />
        </div>
      </div>
    </Modal>
  );
}
