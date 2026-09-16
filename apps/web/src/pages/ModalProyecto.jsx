import { useEffect, useState } from "react";

import { CAMPOS_PROYECTO, TIPOS_DE_CAMPO } from "@ecopac/shared";

import DateField from "../components/DateField";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

function valoresDe(proyecto) {
  return CAMPOS_PROYECTO.reduce((valores, campo) => {
    valores[campo.id] = proyecto?.[campo.id] ?? "";
    return valores;
  }, {});
}

/**
 * Alta y edicion de un proyecto social (issue #756): el boton "+ Nuevo Proyecto" no tenia
 * onClick pese a que crearProyecto()/actualizarProyecto() ya existian en proyectos/api.js.
 * Mismo patron generico dirigido por descriptores que ModalEdicionPaciente.jsx.
 */
export default function ModalProyecto({ visible, proyecto, catalogos, onClose, onGuardar }) {
  const editando = Boolean(proyecto?.id);
  const [valores, setValores] = useState(() => valoresDe(proyecto));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setValores(valoresDe(proyecto));
    setErrores({});
    setError(null);
  }, [proyecto]);

  const cambiar = (id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(proyecto?.id ?? null, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setErrores(resultado.errores ?? {});
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  const opcionesDe = (campo) =>
    campo.opciones ?? (campo.opcionesDesde ? (catalogos?.[campo.opcionesDesde] ?? []) : []);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar proyecto" : "Nuevo proyecto"}
      size="lg"
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      <form onSubmit={guardar}>
        {CAMPOS_PROYECTO.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            const opciones = opcionesDe(campo);
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id]}
                options={opciones}
                onSelect={(valor) => cambiar(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
            return (
              <DateField
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                onChange={(valor) => cambiar(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
              rows={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 3 : undefined}
              maxLength={campo.validacion?.maxLongitud}
              value={valores[campo.id] ?? ""}
              onChange={(evento) => cambiar(campo.id, evento.target.value)}
              error={errores[campo.id]}
              disabled={enviando}
            />
          );
        })}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
          <PrimaryButton
            title={editando ? "Guardar cambios" : "Crear proyecto"}
            onClick={guardar}
            loading={enviando}
            disabled={!valores.nombre}
          />
        </div>
      </form>
    </Modal>
  );
}
