import { useEffect, useState } from "react";

import { CAMPOS_PRINCIPIO_ACTIVO } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";

function valoresDe(principioActivo) {
  return { nombre: principioActivo?.nombre ?? "" };
}

// Modal de alta y edicion del catalogo de principios activos (issue #640), montado desde
// CatalogoPrincipiosActivosPage.jsx con estado local: no tiene ruta propia, mismo patron que
// ModalDiagnostico.jsx. No hay un hook de formulario dedicado en shared -- CAMPOS_PRINCIPIO_ACTIVO
// es un solo campo (nombre) y guardar()/eliminar() ya los resuelve useCatalogoPrincipiosActivos.js
// -- asi que el estado del formulario vive aqui, igual que ModalAltaUsuario.jsx.
//
// `medicamentosEnUso` es la respuesta de eliminar() cuando el principio activo esta asociado a
// uno o mas medicamentos (criterio de aceptacion de la #640): se queda en el modal, mostrando
// cuales, en vez de dejar que el intento falle con el error generico de llave foranea.
export default function ModalPrincipioActivo({
  visible,
  principioActivo,
  onClose,
  onGuardar,
  onEliminar,
}) {
  const [valores, setValores] = useState(() => valoresDe(principioActivo));
  const [error, setError] = useState(null);
  const [medicamentosEnUso, setMedicamentosEnUso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const editando = Boolean(principioActivo?.id);

  useEffect(() => {
    setValores(valoresDe(principioActivo));
    setError(null);
    setMedicamentosEnUso(null);
  }, [principioActivo]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(principioActivo?.id ?? null, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  const eliminar = async () => {
    setEnviando(true);
    setError(null);
    setMedicamentosEnUso(null);

    const resultado = await onEliminar(principioActivo.id);

    setEnviando(false);
    if (resultado.medicamentosEnUso) {
      setMedicamentosEnUso(resultado.medicamentosEnUso);
      return;
    }
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar principio activo" : "Nuevo principio activo"}
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {medicamentosEnUso && (
        <div className="alert alert-warning" role="alert">
          No se puede eliminar: lo usan estos medicamentos.
          <ul className="mb-0 mt-1">
            {medicamentosEnUso.map((medicamento) => (
              <li key={medicamento.id}>{medicamento.nombre}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={guardar}>
        {CAMPOS_PRINCIPIO_ACTIVO.map((campo) => (
          <TextField
            key={campo.id}
            label={campo.label}
            placeholder={campo.placeholder}
            maxLength={campo.validacion?.maxLongitud}
            value={valores[campo.id] ?? ""}
            onChange={(evento) =>
              setValores((anteriores) => ({ ...anteriores, [campo.id]: evento.target.value }))
            }
          />
        ))}

        <div className="d-flex justify-content-between align-items-center mt-3">
          <div>
            {editando && (
              <SecondaryButton title="Eliminar" onClick={eliminar} disabled={enviando} />
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
      </form>
    </Modal>
  );
}
