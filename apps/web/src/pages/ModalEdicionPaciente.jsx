import { useState } from "react";

import { TIPOS_DE_CAMPO, useEdicionPaciente } from "@ecopac/shared";

import DateField from "../components/DateField";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

const TIPO_DE_INPUT = {
  [TIPOS_DE_CAMPO.TEXTO]: "text",
  [TIPOS_DE_CAMPO.TELEFONO]: "tel",
};

export default function ModalEdicionPaciente({ paciente, onClose, onGuardado }) {
  const {
    campos,
    valores,
    errores,
    error,
    enviando,
    hayCambios,
    setCampo,
    descartar,
    guardar,
    catalogos,
  } = useEdicionPaciente(paciente);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  const intentarCerrar = () => {
    if (hayCambios && !enviando) {
      setConfirmandoSalida(true);
      return;
    }
    onClose?.();
  };

  const salirSinGuardar = () => {
    descartar();
    setConfirmandoSalida(false);
    onClose?.();
  };

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.paciente);
  };

  const opcionesDe = (campo) =>
    campo.opciones ?? (campo.opcionesDesde ? (catalogos[campo.opcionesDesde] ?? []) : []);

  return (
    <>
      <Modal
        visible={!confirmandoSalida}
        onClose={intentarCerrar}
        title="Editar datos del paciente"
      >
        {error && (
          <div className="alert alert-danger" role="alert">
            {error.mensaje}
          </div>
        )}

        {campos.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            const opciones = opcionesDe(campo);
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id]}
                options={opciones}
                onSelect={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando || opciones.length === 0}
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
            return (
              <DateField
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                onChange={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              type={TIPO_DE_INPUT[campo.tipo] ?? "text"}
              maxLength={campo.validacion?.maxLongitud}
              value={valores[campo.id] ?? ""}
              onChange={(evento) => setCampo(campo.id, evento.target.value)}
              error={errores[campo.id]}
              disabled={enviando}
            />
          );
        })}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton title="Cancelar" onClick={intentarCerrar} disabled={enviando} />
          <PrimaryButton
            title="Guardar cambios"
            onClick={guardarCambios}
            loading={enviando}
            disabled={!hayCambios}
          />
        </div>
      </Modal>

      <Modal
        visible={confirmandoSalida}
        onClose={() => setConfirmandoSalida(false)}
        title="Hay cambios sin guardar"
      >
        <p>Si salis ahora se pierden los cambios que hiciste en la ficha del paciente.</p>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton title="Seguir editando" onClick={() => setConfirmandoSalida(false)} />
          <PrimaryButton title="Salir sin guardar" onClick={salirSinGuardar} />
        </div>
      </Modal>
    </>
  );
}
