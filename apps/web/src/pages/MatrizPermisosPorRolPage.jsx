import { Check, Eye, ShieldCheck } from "lucide-react";
import { Alert, Form, Table } from "react-bootstrap";
import { Link } from "react-router-dom";

import {
  esAdministrador,
  esConsultivo,
  ESTADOS_DE_ACCESO,
  ETIQUETAS_ROL,
  useMatrizDeAccesoPorRol,
} from "@ecopac/shared";

import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import IconoModulo from "../components/IconoModulo";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatCard from "../components/StatCard";
import "./permisos.css";

// Matriz de acceso a modulos por rol (migracion 00148).
//
// Hasta la 00148 esta pantalla editaba rol_permiso -los nueve permisos finos por defecto de cada
// rol- y no servia: conceder uno no le abria nada a nadie, porque el menu y los botones se decidian
// por rol. Ahora dice una sola cosa, que es la que se le preguntaba: que modulos ve cada rol.
//
//   - "Por defecto": el modulo es del rol y lo usa con todo lo que su rol puede hacer.
//   - Interruptor encendido: la administradora se lo abrio, en SOLO LECTURA. Ve la pantalla y sus
//     datos; registrar, aprobar o eliminar sigue siendo de quien ya podia.
//   - Las funciones de la administradora no se abren aqui: se delegan a una persona concreta desde
//     Colaboradores > Permisos (usuario_permiso).
//
// Matriz de permisos y Bitacora no aparecen: se quedan siempre en la administradora (restriccion
// chk_rol_modulo_modulo de la 00148).

/**
 * Acento de la tarjeta de resumen de cada rol: los tres grupos que declara usuarios/roles.js, que
 * es la unica agrupacion de roles que el sistema reconoce.
 */
function acentoDeRol(rol) {
  if (esAdministrador(rol)) return "var(--color-primary)";
  if (esConsultivo(rol)) return "var(--color-info)";
  return "var(--color-warning)";
}

const EXPLICACION = {
  [ESTADOS_DE_ACCESO.SIEMPRE]: "La administradora ve y usa todos los módulos, siempre.",
  [ESTADOS_DE_ACCESO.POR_DEFECTO]:
    "Es un módulo del rol: lo usa con todo lo que su rol puede hacer. No se cierra desde aquí.",
};

function CeldaDeAcceso({ fila, celda, enProceso, aviso, onAlternar }) {
  const etiquetaRol = ETIQUETAS_ROL[celda.rol] ?? celda.rol;

  if (celda.estado === ESTADOS_DE_ACCESO.SIEMPRE) {
    return (
      <td className="text-center" data-label={etiquetaRol}>
        <span className="matriz-siempre" title={EXPLICACION[celda.estado]}>
          <ShieldCheck size={12} aria-hidden="true" />
          Siempre
        </span>
      </td>
    );
  }

  if (celda.estado === ESTADOS_DE_ACCESO.POR_DEFECTO) {
    return (
      <td className="text-center" data-label={etiquetaRol}>
        <span className="matriz-por-defecto" title={EXPLICACION[celda.estado]}>
          <Check size={12} aria-hidden="true" />
          Por defecto
        </span>
      </td>
    );
  }

  const abierto = celda.estado === ESTADOS_DE_ACCESO.ABIERTO;

  return (
    <td className="text-center" data-label={etiquetaRol}>
      <div className="d-inline-flex align-items-center gap-2">
        <Form.Check
          type="switch"
          className="d-inline-block mb-0"
          checked={abierto}
          disabled={enProceso}
          onChange={() => onAlternar(celda.rol, fila.modulo, abierto)}
          aria-label={`${fila.nombre} para ${etiquetaRol}`}
        />
        {abierto && (
          <span className="matriz-solo-lectura" title="Ve el módulo sin registrar ni aprobar.">
            <Eye size={12} aria-hidden="true" />
            Solo ver
          </span>
        )}
      </div>
      {aviso?.rol === celda.rol && aviso?.modulo === fila.modulo && (
        <div className="text-danger small">{aviso.mensaje}</div>
      )}
    </td>
  );
}

export default function MatrizPermisosPorRolPage() {
  const {
    filas,
    modulosPorRol,
    totalDeModulos,
    cargando,
    error,
    celdaEnProceso,
    avisoSinEfecto,
    alternar,
  } = useMatrizDeAccesoPorRol();

  const roles = filas[0]?.celdas.map((celda) => celda.rol) ?? [];

  return (
    <ScreenContainer>
      <PageHeader
        title="Acceso a módulos por rol"
        subtitle="Qué módulos ve cada rol, además de los suyos"
      />

      <Alert variant="info">
        Abrir un módulo a un rol le deja <strong>ver</strong> sus pantallas y sus datos, sin
        registrar, aprobar ni eliminar. Las funciones de la administradora (aprobar movimientos,
        gestionar jornadas o proyectos, registrar donaciones...) se delegan a una persona concreta
        desde <Link to="/colaboradores">Colaboradores</Link>, en sus permisos.
      </Alert>

      {error && <ErrorState message={error.mensaje} />}
      {cargando && filas.length === 0 && <LoadingState />}

      {filas.length > 0 && (
        <>
          <div className="ec-kpis matriz-resumen">
            {roles.map((rol) => (
              <StatCard
                key={rol}
                label={ETIQUETAS_ROL[rol] ?? rol}
                value={modulosPorRol[rol]}
                caption={`de ${totalDeModulos} módulos`}
                accent={acentoDeRol(rol)}
              />
            ))}
          </div>

          <Card>
            <Table responsive hover className="align-middle mb-0 matriz-permisos">
              <thead>
                <tr>
                  <th scope="col">Módulo</th>
                  {roles.map((rol) => (
                    <th key={rol} scope="col" className="matriz-col-rol">
                      <span className="matriz-rol-nombre">{ETIQUETAS_ROL[rol] ?? rol}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id}>
                    <th scope="row" className="matriz-permiso">
                      <span className="matriz-permiso-descripcion d-flex align-items-center gap-2">
                        <IconoModulo nombre={fila.icono} size={16} />
                        {fila.nombre}
                      </span>
                      <span className="matriz-permiso-clave">{fila.descripcion}</span>
                    </th>
                    {fila.celdas.map((celda) => (
                      <CeldaDeAcceso
                        key={celda.rol}
                        fila={fila}
                        celda={celda}
                        enProceso={
                          celdaEnProceso?.rol === celda.rol &&
                          celdaEnProceso?.modulo === fila.modulo
                        }
                        aviso={avisoSinEfecto}
                        onAlternar={alternar}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}
