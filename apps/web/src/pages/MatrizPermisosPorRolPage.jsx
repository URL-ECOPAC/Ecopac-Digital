import { Info } from "lucide-react";
import { Alert, Form, Table } from "react-bootstrap";

import {
  ETIQUETAS_ROL,
  MODULOS,
  ROLES,
  TODOS_LOS_ROLES,
  puedeNavegarModuloDelPermiso,
  useMatrizPermisosPorRol,
} from "@ecopac/shared";

import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import "./permisos.css";

// Matriz de permisos por rol (issue #638): que permiso trae cada rol por defecto (rol_permiso,
// migracion 00003), antes de solo lectura y ahora editable solo para administrador (00139).
//
// `ETIQUETAS_MODULO`/`ACENTOS_MODULO` calcan la misma derivacion que ya usa
// ModalPermisosUsuario.jsx a partir de MODULOS (navegacion.js): item.modulo coincide a proposito
// con la columna `modulo` de la tabla `permisos`.
const ETIQUETAS_MODULO = Object.fromEntries(
  MODULOS.filter((item) => item.modulo).map((item) => [item.modulo, item.nombre]),
);

const ACENTOS_MODULO = Object.fromEntries(
  MODULOS.filter((item) => item.modulo).map((item) => [
    item.modulo,
    `var(--accent-${item.id}, var(--color-primary))`,
  ]),
);

const EXPLICACION_COLUMNA_ADMINISTRADOR =
  "La administradora siempre tiene acceso completo a todo el sistema, sin importar esta " +
  "casilla: marcarla o desmarcarla no cambia lo que puede hacer.";

/**
 * Encontrado probando en vivo (issue #638): conceder un permiso a un rol que ese modulo no le
 * muestra en el menu no tiene ningun efecto -el rol nunca llega a la pantalla donde importaria-.
 * Se advierte en vez de bloquear: sigue siendo un valor real y guardado, por si el modulo se
 * abre a ese rol mas adelante.
 */
function explicacionSinAcceso(rol) {
  const etiqueta = ETIQUETAS_ROL[rol] ?? rol;
  return `${etiqueta} no ve este módulo en el sistema, así que este permiso no tendría ningún efecto aunque quede marcado.`;
}

function CasillaDePermiso({ rol, permiso, enProceso, avisoSinEfecto, onCambiar }) {
  const concedido = permiso.rolesConcedidos?.has(rol) ?? false;
  const esAdministrador = rol === ROLES.ADMINISTRADOR;
  const sinAcceso = !esAdministrador && !puedeNavegarModuloDelPermiso(rol, permiso.modulo);

  return (
    <td className="text-center">
      <span title={esAdministrador ? EXPLICACION_COLUMNA_ADMINISTRADOR : undefined}>
        <Form.Check
          type="switch"
          checked={esAdministrador ? true : concedido}
          disabled={esAdministrador || enProceso}
          onChange={() => onCambiar(rol, permiso.clave, concedido)}
          aria-label={`${permiso.clave} para ${ETIQUETAS_ROL[rol] ?? rol}`}
        />
      </span>
      {sinAcceso && (
        <div className="permiso-sin-efecto mt-1" title={explicacionSinAcceso(rol)}>
          <Info size={12} aria-hidden="true" />
          Sin acceso al módulo
        </div>
      )}
      {avisoSinEfecto?.rol === rol && avisoSinEfecto?.clave === permiso.clave && (
        <div className="text-danger small">{avisoSinEfecto.mensaje}</div>
      )}
    </td>
  );
}

export default function MatrizPermisosPorRolPage() {
  const { modulos, cargando, error, celdaEnProceso, avisoSinEfecto, alternar } =
    useMatrizPermisosPorRol();

  return (
    <ScreenContainer>
      <PageHeader
        title="Matriz de permisos por rol"
        subtitle="Qué puede hacer cada rol por defecto, y quién lo cambió"
      />

      <Alert variant="info">
        Esta pantalla cambia lo que un rol puede hacer <strong>por defecto</strong>. Marcar o quitar
        una casilla aquí no da ni quita acceso por sí sola: la protección real la aplica el sistema
        del lado del servidor, no esta pantalla. Si el sistema todavía no usa un permiso para
        decidir algo, cambiarlo aquí no tendrá ningún efecto.
      </Alert>

      {error && <ErrorState message={error.mensaje} />}
      {cargando && <LoadingState />}

      {!cargando &&
        modulos.map(({ modulo, permisos }) => (
          <div className="mb-3" key={modulo}>
            <Card
              title={ETIQUETAS_MODULO[modulo] ?? modulo}
              accent={ACENTOS_MODULO[modulo] ?? "var(--color-primary)"}
            >
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Permiso</th>
                    {TODOS_LOS_ROLES.map((rol) => (
                      <th key={rol} className="text-center">
                        {ETIQUETAS_ROL[rol] ?? rol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permisos.map((permiso) => (
                    <tr key={permiso.clave}>
                      <td>
                        <div className="fw-semibold">{permiso.descripcion || permiso.clave}</div>
                      </td>
                      {TODOS_LOS_ROLES.map((rol) => (
                        <CasillaDePermiso
                          key={rol}
                          rol={rol}
                          permiso={permiso}
                          enProceso={
                            celdaEnProceso?.rol === rol && celdaEnProceso?.clave === permiso.clave
                          }
                          avisoSinEfecto={avisoSinEfecto}
                          onCambiar={alternar}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        ))}
    </ScreenContainer>
  );
}
