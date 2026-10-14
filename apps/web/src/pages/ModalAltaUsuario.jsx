import { CAMPOS_ALTA_USUARIO, useAltaUsuario } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SeccionDeFormulario from "../components/SeccionDeFormulario";
import SecondaryButton from "../components/SecondaryButton";
import { UserPlus, X } from "lucide-react";

// Modal de alta de usuario (issue #106), montado desde ColaboradoresPage.jsx con estado local: no
// tiene ruta propia. No va en components/: ese barril es el catalogo de #280, y este modal es
// especifico de esta pantalla, no una pieza reutilizable por otras.
//
// Solo dibuja lo que useAltaUsuario() le entrega. Etiquetas, tipos y orden de los campos salen
// de CAMPOS_ALTA_USUARIO, el mismo juego que dibuja ModalEdicionUsuario.jsx (issue #840, B1), y
// con la misma seccion: crear y editar a un colaborador se ven igual.
//
// El selector de especialidades del prototipo sigue sin estar aca, pero ya no por falta de
// permisos ni de componente: el alta es una INVITACION, y la Edge Function invitar-usuario crea
// la fila de `perfiles` del lado del servidor. Una especialidad referencia ese perfil por FK
// (perfil_especialidad.perfil_id, 00002), asi que no hay a que colgarla hasta que el perfil
// exista. Se registran despues, desde ModalEdicionUsuario.jsx, que es donde vive ahora el
// selector real (MultiSelector + useEspecialidadesDePerfil).

export default function ModalAltaUsuario({ visible, onClose, onUsuarioCreado }) {
  const { valores, errores, error, enviando, setCampo, enviar, cancelar } = useAltaUsuario();

  const cerrar = () => {
    cancelar();
    onClose?.();
  };

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onUsuarioCreado?.(resultado.usuario, resultado.aviso);
      onClose?.();
    }
  };

  return (
    <Modal visible={visible} onClose={cerrar} title="Nuevo colaborador" size="lg">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      <SeccionDeFormulario
        titulo="Datos del colaborador"
        descripcion="Los datos de contacto y el rol con el que entra al sistema."
        acento="var(--accent-colaboradores)"
        campos={CAMPOS_ALTA_USUARIO}
        valores={valores}
        errores={errores}
        onChange={setCampo}
        disabled={enviando}
      >
        <div className="ec-acciones ec-acciones--fin">
          <SecondaryButton
            title="Cancelar"
            variant="neutra"
            onClick={cerrar}
            disabled={enviando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title="Invitar"
            onClick={guardar}
            loading={enviando}
            icon={<UserPlus size={16} aria-hidden="true" />}
          />
        </div>
      </SeccionDeFormulario>
    </Modal>
  );
}
