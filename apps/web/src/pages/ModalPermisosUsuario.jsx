import {
  MODULOS,
  ORIGEN_PERMISO,
  accionesDisponibles,
  permisoGobiernaAlgunaPolitica,
  useGestionPermisos,
} from '@ecopac/shared';

import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import Modal from '../components/Modal';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import StatusChip from '../components/StatusChip';

// Modal de permisos individuales de un usuario (issue #108), abierto DIRECTO desde la fila del
// listado en VoluntariosPage.jsx -no desde adentro de ModalEdicionUsuario-: es una accion
// hermana de "Editar", al mismo nivel, no anidada (PLAN.md, decision 2). El segundo boton por
// fila que esto necesita lo da la prop accionSecundaria de DataList.jsx, agregada para este
// issue con autorizacion explicita para tocar el catalogo.
//
// Solo dibuja lo que useGestionPermisos() ya resuelve: la combinacion rol/individual y el
// origen de cada permiso salen de obtenerPermisosEfectivos() (permisos.api.js, issue #104), no
// se recalculan aca.
//
// `MODULOS` (packages/shared/navegacion.js) presta la etiqueta legible de cada modulo -su
// campo `modulo` coincide a proposito con la columna `modulo` de la tabla `permisos`, ver el
// comentario de esa constante-, sin duplicar esa lista en este archivo.
const ETIQUETAS_MODULO = Object.fromEntries(
  MODULOS.filter((item) => item.modulo).map((item) => [item.modulo, item.etiqueta]),
);

export default function ModalPermisosUsuario({ perfil, onClose }) {
  const { modulos, cargando, error, claveEnProceso, avisoSinEfecto, conceder, revocar, restablecer } =
    useGestionPermisos(perfil?.id);

  const nombre = [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(' ');

  return (
    <Modal visible onClose={onClose} title={`Permisos de ${nombre}`} size="xl">
      {/* Criterio de alcance de #108: los permisos individuales existen y quedan auditados,
          pero de los nueve del catalogo solo tres cambian hoy lo que el servidor permite. La
          marca por permiso (mas abajo, junto a cada fila que no gobierna ninguna politica)
          sale de permisoGobiernaAlgunaPolitica() en shared, no de una lista escrita aca: cuando
          la issue #409 conecte uno, alcanza con actualizar ese unico lugar. */}
      <div className="alert alert-info" role="status">
        Los permisos marcados como "sin efecto todavia" quedan guardados y auditados, pero hoy
        ninguna politica del servidor los consulta: conceder o revocarlos no cambia lo que esta
        persona puede hacer hasta que la issue #409 los conecte.
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {cargando && <LoadingState />}

      {!cargando && !error && modulos.length === 0 && <ErrorState message="No hay permisos que mostrar." />}

      {!cargando &&
        modulos.map(({ modulo, permisos }) => (
          <div key={modulo} className="mb-4">
            <h3 className="h6 text-uppercase text-muted mb-2">
              {ETIQUETAS_MODULO[modulo] ?? modulo}
            </h3>

            {permisos.map((permiso) => {
              const enProceso = claveEnProceso === permiso.clave;
              const esIndividual = permiso.origen === ORIGEN_PERMISO.INDIVIDUAL;
              const { mostrarConceder, mostrarRevocar, mostrarRestablecer } =
                accionesDisponibles(permiso);

              return (
                <div
                  key={permiso.clave}
                  className="d-flex justify-content-between align-items-start gap-3 py-2 border-bottom"
                >
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="fw-semibold">{permiso.descripcion || permiso.clave}</span>
                      <StatusChip
                        status={permiso.origen}
                        label={esIndividual ? 'Individual' : 'Del rol'}
                      />
                    </div>

                    {!permisoGobiernaAlgunaPolitica(permiso.clave) && (
                      <p className="text-muted small mb-0 mt-1">
                        Sin efecto todavia: ninguna politica lo consulta (issue #409).
                      </p>
                    )}

                    {avisoSinEfecto?.clave === permiso.clave && (
                      <p className="text-danger small mb-0 mt-1">{avisoSinEfecto.mensaje}</p>
                    )}
                  </div>

                  <div className="d-flex gap-2 flex-shrink-0">
                    {mostrarConceder && (
                      <PrimaryButton
                        title="Conceder"
                        onClick={() => conceder(permiso.clave)}
                        loading={enProceso}
                      />
                    )}
                    {mostrarRevocar && (
                      <PrimaryButton
                        title="Revocar"
                        onClick={() => revocar(permiso.clave)}
                        loading={enProceso}
                      />
                    )}
                    {mostrarRestablecer && (
                      <SecondaryButton
                        title="Restablecer"
                        onClick={() => restablecer(permiso.clave)}
                        disabled={enProceso}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      <div className="d-flex justify-content-end mt-3">
        <SecondaryButton title="Cerrar" onClick={onClose} />
      </div>
    </Modal>
  );
}
