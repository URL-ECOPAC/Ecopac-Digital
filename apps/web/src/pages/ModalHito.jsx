import { useEffect, useState } from "react";

import { TIPOS_DE_CAMPO } from "@ecopac/shared";

import DateField from "../components/DateField";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import { X } from "lucide-react";

function valoresDe(hito, campos) {
  return campos.reduce((valores, campo) => {
    valores[campo.id] = hito?.[campo.id] ?? "";
    return valores;
  }, {});
}

/**
 * Alta y correccion de un hito de proyecto (issue #756): proyecto_hitos no tenia formulario de
 * alta, y `fechaReal` solo se podia poner en hoy/NULL desde el checkbox de "cumplido" -sin forma
 * de escribir una fecha distinta cuando el hito se anota dias despues. Mismo patron generico
 * dirigido por descriptores (CAMPOS_HITO) que ModalProyecto.jsx.
 */
export default function ModalHito({ visible, hito, campos, errores, onClose, onGuardar }) {
  const editando = Boolean(hito?.id);
  const [valores, setValores] = useState(() => valoresDe(hito, campos));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setValores(valoresDe(hito, campos));
    setError(null);
  }, [hito, campos]);

  const cambiar = (id, valor) => setValores((anteriores) => ({ ...anteriores, [id]: valor }));

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(hito?.id ?? null, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  return (
    <Modal visible={visible} onClose={onClose} title={editando ? "Corregir hito" : "Nuevo hito"}>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      <form onSubmit={guardar}>
        {campos.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
            return (
              <DateField
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                onChange={(valor) => cambiar(campo.id, valor)}
                error={errores?.[campo.id]}
                disabled={enviando}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
              rows={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 2 : undefined}
              maxLength={campo.validacion?.maxLongitud}
              value={valores[campo.id] ?? ""}
              onChange={(evento) => cambiar(campo.id, evento.target.value)}
              error={errores?.[campo.id]}
              disabled={enviando}
            />
          );
        })}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton
            title="Cancelar"
            onClick={onClose}
            disabled={enviando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title={editando ? "Guardar cambios" : "Crear hito"}
            onClick={guardar}
            loading={enviando}
          />
        </div>
      </form>
    </Modal>
  );
}
