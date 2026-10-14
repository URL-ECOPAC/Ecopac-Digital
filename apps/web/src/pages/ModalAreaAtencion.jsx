import { useState } from "react";

import CampoDeFormulario from "../components/CampoDeFormulario";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";

// Modal de alta y edicion del catalogo de areas de atencion (issue #927, 00182), montado desde
// CatalogoAreasPage.jsx con estado local, mismo patron que ModalCondicionCronica.jsx. Los campos
// salen de CAMPOS_AREA_CATALOGO (shared) y se dibujan con CampoDeFormulario.
//
// `area` decide el modo: null es alta, un objeto con id es edicion. No hay boton de borrar: un area
// se retira (es_vigente) y paciente_area la referencia ON DELETE RESTRICT.
export default function ModalAreaAtencion({
  visible,
  area,
  campos,
  enviando = false,
  errores = {},
  onClose,
  onCrear,
  onEditar,
  onAlternarVigencia,
}) {
  const editando = Boolean(area?.id);
  const [valores, setValores] = useState({
    nombre: area?.nombre ?? "",
    descripcion: area?.descripcion ?? "",
  });

  const guardar = async () => {
    const resultado = editando ? await onEditar?.(area.id, valores) : await onCrear?.(valores);
    if (resultado?.ok) onClose?.();
  };

  const alternarVigencia = async () => {
    const resultado = await onAlternarVigencia?.(area);
    if (resultado?.ok) onClose?.();
  };

  return (
    <Modal visible={visible} onClose={onClose} title={editando ? "Editar área" : "Nueva área"}>
      <div className="d-flex flex-column gap-2">
        {campos.map((campo) => (
          <CampoDeFormulario
            key={campo.id}
            campo={campo}
            valor={valores[campo.id]}
            onChange={(valor) => setValores((actuales) => ({ ...actuales, [campo.id]: valor }))}
            error={errores[campo.id]}
            disabled={enviando}
          />
        ))}
        {errores.general && <p className="text-danger small mb-0">{errores.general}</p>}
      </div>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <div>
          {editando && (
            <SecondaryButton
              title={area.esVigente ? "Retirar" : "Reactivar"}
              onClick={alternarVigencia}
              disabled={enviando}
            />
          )}
        </div>
        <div className="d-flex gap-2">
          <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
          <PrimaryButton
            title={editando ? "Guardar cambios" : "Crear área"}
            onClick={guardar}
            loading={enviando}
          />
        </div>
      </div>
    </Modal>
  );
}
