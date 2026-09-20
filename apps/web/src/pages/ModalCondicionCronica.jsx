import { useState } from "react";
import { X } from "lucide-react";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";

// Modal de alta y edicion del catalogo de condiciones cronicas (issue #850), montado desde
// CatalogoCondicionesPage.jsx con estado local: no tiene ruta propia, mismo patron que
// ModalDiagnostico.jsx.
//
// `condicion` decide el modo: null es alta, un objeto con id es edicion. La pantalla solo abre el
// modo edicion para quien puede mantener el catalogo (politica de UPDATE de la 00140), asi que
// aqui `puedeMantener` sirve para no dibujar un boton "Retirar" que el servidor filtraria si
// alguna vez se abriera de otra forma.
//
// No hay boton de borrar, y no es un olvido: la 00140 no concede DELETE y padecimientos_cronicos
// referencia el catalogo ON DELETE RESTRICT (00010). Retirar es logico.
export default function ModalCondicionCronica({
  visible,
  condicion,
  enviando = false,
  errores = {},
  puedeMantener = false,
  onClose,
  onCrear,
  onEditar,
  onAlternarVigencia,
}) {
  const editando = Boolean(condicion?.id);
  const [nombre, setNombre] = useState(condicion?.nombre ?? "");

  const guardar = async () => {
    const resultado = editando
      ? await onEditar?.(condicion.id, { nombre })
      : await onCrear?.(nombre);
    if (resultado?.ok) onClose?.();
  };

  const alternarVigencia = async () => {
    const resultado = await onAlternarVigencia?.(condicion);
    if (resultado?.ok) onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar condición" : "Nueva condición"}
    >
      <TextField
        label="Nombre de la condición"
        placeholder="Ej. Artritis reumatoide"
        maxLength={100}
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        error={errores.nombre}
        disabled={enviando}
      />

      <div className="d-flex justify-content-between align-items-center mt-3">
        <div>
          {editando && puedeMantener && (
            <SecondaryButton
              title={condicion.esVigente ? "Retirar" : "Reactivar"}
              onClick={alternarVigencia}
              disabled={enviando}
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
    </Modal>
  );
}
