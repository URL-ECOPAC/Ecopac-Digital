import { useEffect } from "react";

import { useDesasignacionPersonal } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";

// Dialogo de confirmacion de desasignar a alguien de una jornada (issue #182, criterio 4). No es
// un componente de catalogo: compone Modal + PrimaryButton + SecondaryButton, mismo patron que
// ModalConfirmarDesactivacion.jsx (#107), incluido el useEffect que llama a abrir(persona) al
// montar: el hook necesita su propio estado para confirmar(), la fila que llega por props es solo
// para mostrar el nombre.
//
// A diferencia de ModalConfirmarDesactivacion.jsx, no hay ningun chequeo de cliente antes de
// confirmar: no existe una funcion en lote para saber de antemano quien ya registro atenciones en
// esta jornada (packages/shared/jornadas/useAsignacionPersonal.js, useDesasignacionPersonal()). El
// boton "Desasignar" queda siempre activo; si el servidor lo bloquea, desasignarPersonal() (api.js)
// devuelve el mismo error 'check' que se muestra aca tal cual, sin reescribirlo.
export default function ModalConfirmarDesasignacion({
  visible,
  jornadaId,
  persona,
  onClose,
  onDesasignado,
}) {
  const { enviando, error, abrir, confirmar } = useDesasignacionPersonal({ jornadaId });

  useEffect(() => {
    abrir(persona);
    // Solo se evalua al abrir este dialogo con la fila que llego por props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.perfilId]);

  const confirmarAccion = async () => {
    const resultado = await confirmar();
    if (resultado.ok) onDesasignado?.();
  };

  const nombre = persona?.perfil ?? "esta persona";

  return (
    <Modal visible={visible} onClose={onClose} title="Desasignar personal">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      <p>
        ¿Quitar a <strong>{nombre}</strong> de esta jornada? Si ya registro una consulta o un triaje
        aca, el sistema va a rechazar la desasignacion.
      </p>

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
        <PrimaryButton title="Desasignar" onClick={confirmarAccion} loading={enviando} />
      </div>
    </Modal>
  );
}
