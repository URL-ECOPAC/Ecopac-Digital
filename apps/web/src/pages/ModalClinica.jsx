import { useState } from "react";
import { Alert } from "react-bootstrap";

import CampoDeFormulario from "../components/CampoDeFormulario";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";

// Modal de alta y edicion de una clinica (issue #927, 00183), montado desde CatalogoClinicasPage.jsx
// con estado local. Los campos salen de CAMPOS_CLINICA (shared).
//
// "Eliminar" pide confirmacion en el mismo modal: la base decide si la borra (nunca tuvo citas) o
// la retira (las tuvo), y la pantalla avisa que paso.
export default function ModalClinica({
  visible,
  clinica,
  campos,
  enviando = false,
  errores = {},
  puedeMantener = false,
  puedeRetirar = false,
  onClose,
  onCrear,
  onEditar,
  onAlternarVigencia,
  onEliminar,
}) {
  const editando = Boolean(clinica?.id);
  const [valores, setValores] = useState({
    nombre: clinica?.nombre ?? "",
    salasDisponibles: clinica?.salasDisponibles ?? "",
  });
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const soloLectura = editando && !puedeMantener;

  const cerrarSiSalioBien = (resultado) => {
    if (resultado?.ok) onClose?.();
  };

  const guardar = async () =>
    cerrarSiSalioBien(editando ? await onEditar?.(clinica.id, valores) : await onCrear?.(valores));

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar clínica" : "Nueva clínica"}
    >
      <div className="d-flex flex-column gap-2">
        {campos.map((campo) => (
          <CampoDeFormulario
            key={campo.id}
            campo={campo}
            valor={valores[campo.id]}
            onChange={(valor) => setValores((actuales) => ({ ...actuales, [campo.id]: valor }))}
            error={errores[campo.id]}
            disabled={enviando || soloLectura}
          />
        ))}
        {errores.general && <p className="text-danger small mb-0">{errores.general}</p>}
      </div>

      {confirmandoEliminar && (
        <Alert variant="warning" className="mt-3 mb-0 py-2 px-3 small">
          ¿Eliminar «{clinica.nombre}»? Si ya tiene citas no se borra: se retira y las conserva.
          <div className="d-flex gap-2 mt-2">
            <SecondaryButton
              title="No, volver"
              onClick={() => setConfirmandoEliminar(false)}
              disabled={enviando}
            />
            <PrimaryButton
              title="Sí, eliminar"
              onClick={async () => cerrarSiSalioBien(await onEliminar?.(clinica))}
              loading={enviando}
            />
          </div>
        </Alert>
      )}

      {/* Con las acciones de la administradora son cuatro botones: el pie se parte en dos filas en
          vez de apretar el texto de cada uno. */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
        <div className="d-flex gap-2">
          {editando && puedeRetirar && !confirmandoEliminar && (
            <>
              <SecondaryButton
                title={clinica.esVigente ? "Retirar" : "Reactivar"}
                onClick={async () => cerrarSiSalioBien(await onAlternarVigencia?.(clinica))}
                disabled={enviando}
              />
              <SecondaryButton
                title="Eliminar"
                onClick={() => setConfirmandoEliminar(true)}
                disabled={enviando}
              />
            </>
          )}
        </div>
        <div className="d-flex gap-2 ms-auto">
          <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
          {!soloLectura && (
            <PrimaryButton
              title={editando ? "Guardar cambios" : "Crear clínica"}
              onClick={guardar}
              loading={enviando}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
