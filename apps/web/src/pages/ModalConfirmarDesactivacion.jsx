import { useEffect } from 'react';

import { useDesactivacionUsuario } from '@ecopac/shared';

import Modal from '../components/Modal';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';

// Dialogo de confirmacion de desactivar/reactivar un usuario (issue #107, criterio 2). No es
// un componente nuevo de catalogo: compone Modal + PrimaryButton + SecondaryButton, mismo
// patron que ya usa ModalAltaUsuario.jsx (#106) con sus propios campos.
//
// El chequeo de "no sos vos" y "no es el ultimo administrador activo" (useDesactivacionUsuario,
// packages/shared/usuarios/) es UX: evita llamar al servidor para una operacion que va a
// rechazar, mostrando un mensaje propio y especifico. La defensa real son los triggers
// impedir_autodesactivacion() e impedir_dejar_sin_administrador_activo() de la migracion
// 00072 (issue #107, PLAN.md paso 1).
//
// El texto NO dice que la persona "pierde el acceso de inmediato": una sesion ya abierta sigue
// teniendo acceso real a los datos hasta que expire o alguien la cierre (hallazgo (c) del plan
// de #107 -- va a un issue nuevo, no se resuelve aca). Dice que no podra volver a iniciar
// sesion, que es lo unico que el sistema si garantiza hoy.
export default function ModalConfirmarDesactivacion({ perfil, idSesionActual, onClose, onResuelto }) {
  const { verificando, bloqueo, enviando, error, abrir, confirmar } = useDesactivacionUsuario({
    idSesionActual,
  });

  useEffect(() => {
    abrir(perfil);
    // Solo se evalua una vez, al abrir este dialogo con el perfil que llego por props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const desactivando = perfil?.activo === true;
  const titulo = desactivando ? 'Desactivar voluntario' : 'Reactivar voluntario';
  const nombre = [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(' ');

  const confirmarAccion = async () => {
    const resultado = await confirmar();
    if (resultado.ok) onResuelto?.(resultado.perfil);
  };

  return (
    <Modal visible onClose={onClose} title={titulo}>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {verificando && <p className="text-muted">Comprobando...</p>}

      {!verificando && bloqueo && (
        <div className="alert alert-warning" role="alert">
          {bloqueo}
        </div>
      )}

      {!verificando && !bloqueo && (
        <p>
          {desactivando
            ? `${nombre} no podra volver a iniciar sesion hasta que se reactive su cuenta.`
            : `${nombre} podra volver a iniciar sesion.`}
        </p>
      )}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title={bloqueo ? 'Cerrar' : 'Cancelar'} onClick={onClose} disabled={enviando} />
        {!bloqueo && (
          <PrimaryButton
            title={desactivando ? 'Desactivar' : 'Reactivar'}
            onClick={confirmarAccion}
            loading={enviando}
            disabled={verificando}
          />
        )}
      </div>
    </Modal>
  );
}
