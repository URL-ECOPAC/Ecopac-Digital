import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  cabeceraDePaciente,
  CAMPOS_FICHA_PACIENTE,
  permisosDeFicha,
  pestaniasDeFicha,
  resolverPestaniaDeFicha,
  textoDeCampoDeFicha,
  usePaciente,
  usePacientesListado,
  valoresDeFichaPaciente,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  ScreenContainer,
  StatusChip,
  Tabs,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ListaPacientes from "./ListaPacientes";
import ModalCondicionesPaciente from "./ModalCondicionesPaciente";
import ModalEdicionPaciente from "./ModalEdicionPaciente";
import NotFoundPage from "./NotFoundPage";
import "./pacientes.css";
import PestaniaHistorialPaciente from "./PestaniaHistorialPaciente";
import PestaniaRecetasPaciente from "./PestaniaRecetasPaciente";
import PestaniaSignosPaciente from "./PestaniaSignosPaciente";

const PARAMETRO_PESTANIA = "pestania";

function claseDeAvatar(sexo) {
  const normalizado = String(sexo ?? "")
    .trim()
    .toLowerCase();
  if (normalizado === "femenino") return " pac-avatar--femenino";
  if (normalizado === "masculino") return " pac-avatar--masculino";
  return "";
}

export default function FichaPacientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const { rol } = useSesionCompartida();
  const { paciente, cargando, error, recargar } = usePaciente(id, { rol });
  const listado = usePacientesListado();
  const [editando, setEditando] = useState(false);
  const [gestionandoCondiciones, setGestionandoCondiciones] = useState(false);

  const pestanias = pestaniasDeFicha(rol);
  const permisos = permisosDeFicha(rol);
  const pestaniaActiva = resolverPestaniaDeFicha(parametros.get(PARAMETRO_PESTANIA), rol);

  const cambiarPestania = (siguiente) => {
    const proximos = new URLSearchParams(parametros);
    proximos.set(PARAMETRO_PESTANIA, siguiente);
    setParametros(proximos, { replace: true });
  };

  if (cargando && !paciente) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <LoadingState />
        </div>
      </ScreenContainer>
    );
  }

  if (error && !paciente) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Ficha del paciente"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
            ]}
          />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  if (!paciente) {
    return <NotFoundPage />;
  }

  const cabecera = cabeceraDePaciente(paciente);
  const valores = valoresDeFichaPaciente(paciente);

  const acciones = [
    { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
  ];

  if (permisos.puedeEditar) {
    acciones.push({ label: "Editar datos", onClick: () => setEditando(true) });
    acciones.push({
      label: "Condiciones cronicas",
      onClick: () => setGestionandoCondiciones(true),
      variant: "secondary",
    });
  }

  const alGuardar = async () => {
    setEditando(false);
    await recargar();
  };

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <div className="pac-maestro-detalle">
          <ListaPacientes
            filas={listado.filas}
            total={listado.total}
            cargando={listado.cargando}
            activoId={id}
            onSeleccionar={(fila) => navigate(`/pacientes/${fila.id}`)}
          />

          <div>
            <Card>
              <div className="d-flex justify-content-end gap-3 mb-2">
                {acciones.map((accion) => (
                  <button
                    key={accion.label}
                    type="button"
                    className="btn btn-link p-0"
                    onClick={accion.onClick}
                  >
                    {accion.label}
                  </button>
                ))}
              </div>

              <div className="pac-identidad">
                <span
                  className={`pac-avatar pac-avatar--grande${claseDeAvatar(valores.sexo)}`}
                  aria-hidden="true"
                >
                  {(cabecera.nombreCompleto ?? "?").charAt(0)}
                </span>
                <div>
                  <h2 className="pac-nombre">{cabecera.nombreCompleto ?? "Paciente sin nombre"}</h2>
                  <p className="pac-dato-mono mb-2">
                    {valores.dpi ? `DPI: ${valores.dpi}` : "Sin DPI registrado"}
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    {valores.tipoSangre && (
                      <span className="pac-chip pac-chip--sangre">TIPO {valores.tipoSangre}</span>
                    )}
                    {valores.sexo && (
                      <span className="pac-chip pac-chip--sexo">
                        {String(valores.sexo).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <dl className="row pac-datos mb-0">
                <div className="col-sm-3 mb-2">
                  <dt className="pac-rotulo">Edad</dt>
                  <dd className="mb-0">{cabecera.edad ?? "—"}</dd>
                </div>
                <div className="col-sm-3 mb-2">
                  <dt className="pac-rotulo">Comunidad</dt>
                  <dd className="mb-0">{cabecera.comunidad ?? "—"}</dd>
                </div>
                <div className="col-sm-3 mb-2">
                  <dt className="pac-rotulo">Ficha</dt>
                  <dd className="mb-0">{cabecera.numeroFicha ?? "—"}</dd>
                </div>
                <div className="col-sm-3 mb-2">
                  <dt className="pac-rotulo">Telefono</dt>
                  <dd className="mb-0">{valores.telefonoContacto ?? "—"}</dd>
                </div>
              </dl>

              {cabecera.condiciones.length > 0 && (
                <div className="pac-datos">
                  <p className="pac-rotulo mb-2">Condiciones</p>
                  <div className="d-flex flex-wrap gap-2">
                    {cabecera.condiciones.map((condicion) => (
                      <StatusChip
                        key={condicion.id}
                        status={condicion.estado}
                        label={`${condicion.nombre} · ${condicion.etiquetaEstado}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="mt-3" />

            <Tabs tabs={pestanias} activo={pestaniaActiva} onChange={cambiarPestania}>
              {pestaniaActiva === "generales" && (
                <Card>
                  <dl className="row mb-0">
                    {CAMPOS_FICHA_PACIENTE.map((campo) => (
                      <div className="col-sm-6 mb-2" key={campo.id}>
                        <dt className="pac-rotulo">{campo.label}</dt>
                        <dd className="mb-0">{textoDeCampoDeFicha(campo, valores)}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )}

              {pestaniaActiva === "historial" && (
                <PestaniaHistorialPaciente pacienteId={paciente.id} rol={rol} />
              )}

              {pestaniaActiva === "signos" && (
                <PestaniaSignosPaciente pacienteId={paciente.id} rol={rol} />
              )}

              {pestaniaActiva === "recetas" && (
                <PestaniaRecetasPaciente paciente={paciente} rol={rol} />
              )}
            </Tabs>

            {editando && (
              <ModalEdicionPaciente
                paciente={paciente}
                onClose={() => setEditando(false)}
                onGuardado={alGuardar}
              />
            )}

            {gestionandoCondiciones && (
              <ModalCondicionesPaciente
                pacienteId={paciente.id}
                rol={rol}
                onClose={() => setGestionandoCondiciones(false)}
                onCambio={recargar}
              />
            )}
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}
