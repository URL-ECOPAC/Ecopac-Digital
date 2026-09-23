import { Info, ShieldCheck } from "lucide-react";
import { Alert, Form, Table } from "react-bootstrap";

import {
  esAdministrador,
  esConsultivo,
  ETIQUETAS_ROL,
  MODULOS,
  puedeNavegarModuloDelPermiso,
  TODOS_LOS_ROLES,
  useMatrizPermisosPorRol,
} from "@ecopac/shared";

import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatCard from "../components/StatCard";
import "./permisos.css";

// Matriz de permisos por rol (issue #638): que permiso trae cada rol por defecto (rol_permiso,
// migracion 00003), antes de solo lectura y ahora editable solo para administrador (00139).
//
// SEGUNDA PASADA DE DISENO (issue #864). Eran nueve tarjetas, cada una con su tabla y su propio
// ancho de columnas, asi que las cabeceras de rol no quedaban alineadas de una tarjeta a la
// siguiente y la vista no se leia como una matriz. Ademas el aviso "Sin acceso al modulo" se
// repetia celda por celda -hasta cuatro veces en una fila de un solo permiso- y la columna de la
// administradora era un interruptor marcado y apagado que no explicaba por que.
//
// Lo que se toma del prototipo (docs/DISENO.md; pantallas "Voluntarios y Medicos" e "Inventario"):
// la fila de indicadores arriba -punto de color, rotulo en versalitas, cifra grande y pie-, los
// rotulos de cabecera de tabla en versalitas apagadas, y las pastillas de estado en caja alta.
// El prototipo no tiene pantalla de permisos -es anterior a la #638-, asi que lo que se sigue es
// su lenguaje visual, no una pantalla suya.
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

/**
 * Acento de la tarjeta de resumen de cada rol.
 *
 * No es un color por rol elegido a ojo: son los tres grupos que ya declara
 * packages/shared/usuarios/roles.js -ROLES_ADMINISTRATIVOS, ROLES_CONSULTIVOS y ROLES_DE_CAMPO-,
 * que es la unica agrupacion de roles que el sistema reconoce.
 */
function acentoDeRol(rol) {
  if (esAdministrador(rol)) return "var(--color-primary)";
  if (esConsultivo(rol)) return "var(--color-info)";
  return "var(--color-warning)";
}

const EXPLICACION_COLUMNA_ADMINISTRADOR =
  "La administradora siempre tiene acceso completo a todo el sistema, sin importar esta " +
  "casilla: marcarla o desmarcarla no cambia lo que puede hacer.";

/**
 * Encontrado probando en vivo (issue #638): conceder un permiso a un rol que ese modulo no le
 * muestra en el menu no tiene ningun efecto -el rol nunca llega a la pantalla donde importaria-.
 * Se advierte en vez de bloquear: sigue siendo un valor real y guardado, por si el modulo se
 * abre a ese rol mas adelante.
 *
 * Desde la #864 el aviso vive en la cabecera de la columna y no en cada celda: es una propiedad
 * del par (rol, modulo), no de la celda, asi que repetirlo por fila solo hacia ruido.
 */
function explicacionSinAcceso(rol) {
  const etiqueta = ETIQUETAS_ROL[rol] ?? rol;
  return `${etiqueta} no ve este módulo en el sistema, así que estos permisos no tendrían ningún efecto aunque queden marcados.`;
}

/** Cuantos permisos de esta lista tiene concedidos el rol. La administradora los tiene todos. */
function concedidosDe(permisos, rol) {
  if (esAdministrador(rol)) return permisos.length;
  return permisos.filter((permiso) => permiso.rolesConcedidos?.has(rol)).length;
}

function CabeceraDeRol({ rol, permisos, modulo }) {
  const sinAcceso = !esAdministrador(rol) && !puedeNavegarModuloDelPermiso(rol, modulo);
  const concedidos = concedidosDe(permisos, rol);

  return (
    <th scope="col" className={`matriz-col-rol${sinAcceso ? " matriz-col-rol--sin-acceso" : ""}`}>
      <span className="matriz-rol-nombre">{ETIQUETAS_ROL[rol] ?? rol}</span>
      {sinAcceso ? (
        /* El rotulo va corto -- "Sin acceso" y no "Sin acceso al modulo" -- porque la columna
           mide lo mismo que las otras cuatro y el texto largo la ensanchaba, que es justo lo que
           desalineaba las cabeceras entre tarjetas. La frase entera vive en el title. */
        <span className="permiso-sin-efecto" title={explicacionSinAcceso(rol)}>
          <Info size={12} aria-hidden="true" />
          Sin acceso
        </span>
      ) : (
        <span className="matriz-rol-conteo">
          {concedidos} de {permisos.length}
        </span>
      )}
    </th>
  );
}

function CasillaDePermiso({ rol, permiso, enProceso, avisoSinEfecto, onCambiar }) {
  const concedido = permiso.rolesConcedidos?.has(rol) ?? false;
  const sinAcceso = !esAdministrador(rol) && !puedeNavegarModuloDelPermiso(rol, permiso.modulo);

  // La administradora no lleva interruptor: lo llevaba marcado y deshabilitado, que se lee como
  // "esto se podria cambiar y alguien lo bloqueo". Es un hecho del sistema, no una casilla.
  if (esAdministrador(rol)) {
    return (
      <td className="text-center" data-label={ETIQUETAS_ROL[rol] ?? rol}>
        <span className="matriz-siempre" title={EXPLICACION_COLUMNA_ADMINISTRADOR}>
          <ShieldCheck size={12} aria-hidden="true" />
          Siempre
        </span>
      </td>
    );
  }

  return (
    <td className="text-center" data-label={ETIQUETAS_ROL[rol] ?? rol}>
      {/* En pantalla angosta la cabecera de la tabla no se dibuja, asi que el aviso de "este rol
          no ve el modulo" tiene que volver a la celda o se pierde. Es el mismo DOM en las dos
          anchuras: el CSS lo esconde en escritorio, donde ya lo dice la cabecera. */}
      {sinAcceso && (
        <span
          className="permiso-sin-efecto matriz-sin-acceso-celda"
          title={explicacionSinAcceso(rol)}
        >
          <Info size={12} aria-hidden="true" />
          Sin acceso
        </span>
      )}
      <Form.Check
        type="switch"
        className="d-inline-block"
        checked={concedido}
        disabled={enProceso}
        onChange={() => onCambiar(rol, permiso.clave, concedido)}
        aria-label={`${permiso.clave} para ${ETIQUETAS_ROL[rol] ?? rol}`}
      />
      {avisoSinEfecto?.rol === rol && avisoSinEfecto?.clave === permiso.clave && (
        <div className="text-danger small">{avisoSinEfecto.mensaje}</div>
      )}
    </td>
  );
}

export default function MatrizPermisosPorRolPage() {
  const { modulos, cargando, error, celdaEnProceso, avisoSinEfecto, alternar } =
    useMatrizPermisosPorRol();

  const todosLosPermisos = modulos.flatMap((grupo) => grupo.permisos);

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

      {!cargando && todosLosPermisos.length > 0 && (
        // El resumen contesta de un vistazo la pregunta con la que se entra a esta pantalla
        // -cuanto puede hacer cada rol-, que antes obligaba a contar interruptores en nueve
        // tablas.
        <div className="ec-kpis matriz-resumen">
          {TODOS_LOS_ROLES.map((rol) => (
            <StatCard
              key={rol}
              label={ETIQUETAS_ROL[rol] ?? rol}
              value={concedidosDe(todosLosPermisos, rol)}
              caption={`de ${todosLosPermisos.length} permisos`}
              accent={acentoDeRol(rol)}
            />
          ))}
        </div>
      )}

      {!cargando &&
        modulos.map(({ modulo, permisos }) => (
          <div className="mb-3" key={modulo}>
            <Card
              title={ETIQUETAS_MODULO[modulo] ?? modulo}
              accent={ACENTOS_MODULO[modulo] ?? "var(--color-primary)"}
            >
              <Table responsive hover className="align-middle mb-0 matriz-permisos">
                <thead>
                  <tr>
                    <th scope="col">Permiso</th>
                    {TODOS_LOS_ROLES.map((rol) => (
                      <CabeceraDeRol key={rol} rol={rol} permisos={permisos} modulo={modulo} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permisos.map((permiso) => (
                    <tr key={permiso.clave}>
                      <th scope="row" className="matriz-permiso">
                        <span className="matriz-permiso-descripcion">
                          {permiso.descripcion || permiso.clave}
                        </span>
                        {/* La clave en monoespaciada porque es un identificador que se lee
                            caracter por caracter (docs/DISENO.md, "Tipografia"), y porque es
                            exactamente lo que aparece despues en la bitacora de auditoria. */}
                        <code className="matriz-permiso-clave">{permiso.clave}</code>
                      </th>
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
