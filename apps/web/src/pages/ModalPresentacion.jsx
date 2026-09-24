import { useEffect, useState } from "react";

import { CAMPOS_PRESENTACION } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import { Trash2, X } from "lucide-react";

function valoresDe(presentacion) {
  return { nombre: presentacion?.nombre ?? "" };
}

// Modal de alta y edicion del catalogo de presentaciones (PLAN.md punto 11, 00144), montado
// desde CatalogoPresentacionesPage.jsx o desde ModalMedicamento.jsx con estado local: no tiene
// ruta propia. Mismo patron exacto que ModalPrincipioActivo.jsx -- no hay un hook de formulario
// dedicado en shared: CAMPOS_PRESENTACION es un solo campo (nombre) y guardar()/eliminar() ya
// los resuelve useCatalogoPresentaciones.js -- asi que el estado del formulario vive aqui.
//
// `medicamentosEnUso` es la respuesta de eliminar() cuando la presentacion esta asociada a uno o
// mas medicamentos: se queda en el modal, mostrando cuales, en vez de dejar que el intento falle
// con el error generico de llave foranea.
export default function ModalPresentacion({
  visible,
  presentacion,
  onClose,
  onGuardar,
  onEliminar,
}) {
  const [valores, setValores] = useState(() => valoresDe(presentacion));
  const [error, setError] = useState(null);
  const [medicamentosEnUso, setMedicamentosEnUso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const editando = Boolean(presentacion?.id);

  useEffect(() => {
    setValores(valoresDe(presentacion));
    setError(null);
    setMedicamentosEnUso(null);
  }, [presentacion]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(presentacion?.id ?? null, valores);

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

    const resultado = await onEliminar(presentacion.id);

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
      title={editando ? "Editar presentación" : "Nueva presentación"}
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
        {CAMPOS_PRESENTACION.map((campo) => (
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
              <SecondaryButton
                title="Eliminar"
                onClick={eliminar}
                disabled={enviando}
                icon={<Trash2 size={16} aria-hidden="true" />}
              />
            )}
          </div>
          <div className="d-flex gap-2">
            <SecondaryButton
              title="Cancelar"
              onClick={onClose}
              disabled={enviando}
              icon={<X size={16} aria-hidden="true" />}
            />
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
