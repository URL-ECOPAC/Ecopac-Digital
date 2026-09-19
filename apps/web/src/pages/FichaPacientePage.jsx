import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { HeartPulse, Pencil, Stethoscope } from "lucide-react";

import {
  cabeceraDePaciente,
  CAMPOS_FICHA_PACIENTE,
  formatearFechaCorta,
  permisosDeFicha,
  pestaniasDeFicha,
  resolverPestaniaDeFicha,
  textoDeCampoDeFicha,
  useFusionesDelPaciente,
  usePaciente,
  usePacientesListado,
  valoresDeFichaPaciente,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
  Tabs,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalCondicionesPaciente from "./ModalCondicionesPaciente";
import ModalConsulta from "./ModalConsulta";
import ModalEdicionPaciente from "./ModalEdicionPaciente";
import NotFoundPage from "./NotFoundPage";
import "./pacientes.css";
import PanelPacientes from "./PanelPacientes";
import PestaniaHistorialPaciente from "./PestaniaHistorialPaciente";

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
  const { rol, perfil } = useSesionCompartida();
  const { paciente, cargando, error, recargar } = usePaciente(id, { rol });
  const listado = usePacientesListado();
  const { fusiones: fusionesRecibidas, permitido: puedeVerFusiones } = useFusionesDelPaciente(id, {
    rol,
  });
  const [editando, setEditando] = useState(false);
  const [gestionandoCondiciones, setGestionandoCondiciones] = useState(false);
  // La consulta como unidad (issue #840): un solo modal para una consulta nueva y para abrir una
  // visita existente. `consultaAbierta` es { visita } -null en visita para una nueva- o null.
  // Reemplaza a los tres modales de captura -tomar signos, registrar consulta, generar receta-,
  // que se abrian cada uno desde su pestana.
  const [consultaAbierta, setConsultaAbierta] = useState(null);
  // Se incrementa despues de guardar algo, y va como `key` de la pestania abierta para forzarla
  // a montarse de nuevo: cada pestania tiene su propio hook y no se entera de lo que acaba de
  // guardar un modal hermano.
  const [version, setVersion] = useState(0);

  const pestanias = pestaniasDeFicha(rol);
  const permisos = permisosDeFicha(rol);
  const pestaniaActiva = resolverPestaniaDeFicha(parametros.get(PARAMETRO_PESTANIA), rol);

  const cambiarPestania = (siguiente) => {
    const proximos = new URLSearchParams(parametros);
    proximos.set(PARAMETRO_PESTANIA, siguiente);
    setParametros(proximos, { replace: true });
  };

  const refrescar = async () => {
    setVersion((anterior) => anterior + 1);
    await recargar();
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
            accent="var(--accent-pacientes)"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" },
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

  // La cabecera de la pantalla se queda SOLO con "Volver". Lo demas -editar los datos, gestionar
  // las condiciones cronicas- son acciones sobre el expediente que se esta mirando, no sobre la
  // pantalla, asi que van dentro de la tarjeta de identidad, junto al paciente al que aplican.
  // Ahi tambien se entiende sin leerlas: los botones de la cabecera quedan lejos del nombre y no
  // dicen a quien se va a editar.
  // "Nueva consulta" es LA accion de la ficha (issue #840): llega el paciente, se busca y se le
  // atiende. Por eso es la primaria; editar sus datos pasa a secundaria.
  const accionesDeLaFicha =
    permisos.puedeEditar || permisos.puedeNuevaConsulta ? (
      <>
        {permisos.puedeEditar && (
          <SecondaryButton
            title="Condiciones crónicas"
            icon={<HeartPulse size={16} aria-hidden="true" />}
            onClick={() => setGestionandoCondiciones(true)}
          />
        )}
        {permisos.puedeEditar && (
          <SecondaryButton
            title="Editar datos"
            icon={<Pencil size={16} aria-hidden="true" />}
            onClick={() => setEditando(true)}
          />
        )}
        {permisos.puedeNuevaConsulta && (
          <PrimaryButton
            title="Nueva consulta"
            icon={<Stethoscope size={16} aria-hidden="true" />}
            onClick={() => setConsultaAbierta({ visita: null })}
          />
        )}
      </>
    ) : null;

  const alGuardar = async () => {
    setEditando(false);
    await refrescar();
  };

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title={cabecera.nombreCompleto ?? "Paciente sin nombre"}
          subtitle={
            cabecera.numeroFicha ? `Expediente ${cabecera.numeroFicha}` : "Expediente sin numero"
          }
          accent="var(--accent-pacientes)"
          actions={[{ label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" }]}
        />

        {/* Los filtros y la lista los dibuja PanelPacientes, el mismo componente que usa
          /pacientes. Antes esta pantalla montaba la lista por su cuenta y sin la barra de
          filtros, asi que elegir un paciente los hacia desaparecer. */}
        <PanelPacientes
          listado={listado}
          activoId={id}
          onSeleccionar={(fila) => navigate(`/pacientes/${fila.id}`)}
        >
          <Card actions={accionesDeLaFicha}>
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
                    <span className="ec-chip pac-chip--sangre">TIPO {valores.tipoSangre}</span>
                  )}
                  {valores.sexo && (
                    <span className="ec-chip pac-chip--sexo">
                      {String(valores.sexo).toUpperCase()}
                    </span>
                  )}
                  {/* Un expediente dado de baja tiene que notarse en la cabecera, no solo en la
                    lista de datos generales de la pestania de al lado. */}
                  {valores.fechaBaja && (
                    <StatusChip
                      status="inactivo"
                      label={`Baja el ${formatearFechaCorta(valores.fechaBaja)}`}
                    />
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
                <dt className="pac-rotulo">Teléfono</dt>
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

          {/* Criterio 6 de #637: una fusion hecha por error se tiene que poder consultar
            despues -- que expediente absorbio, cuando y quien la hizo, no solo un conteo. Solo
            se pide/pinta si el rol puede fusionar (mismo gate que la pantalla de posibles
            duplicados), porque RLS igual la deja vacia para cualquier otro rol. */}
          {puedeVerFusiones && fusionesRecibidas.length > 0 && (
            <>
              <div className="mt-3" />
              <Card title="Expedientes fusionados en este paciente">
                <ul className="list-unstyled mb-0">
                  {fusionesRecibidas.map((fusion) => (
                    <li key={fusion.id} className="mb-1">
                      {fusion.absorbido?.nombreCompleto ?? "Expediente sin nombre"}
                      {fusion.absorbido?.numeroFicha
                        ? ` (ficha ${fusion.absorbido.numeroFicha})`
                        : ""}
                      {" — "}
                      {formatearFechaCorta(fusion.realizadaEn)}
                      {fusion.realizadaPor ? ` · ${fusion.realizadaPor}` : ""}
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

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

            {/* El historial es una lista de visitas; cada una trae dentro sus signos, su consulta
              y su receta (issue #840). "Editar" abre el mismo formulario que "Nueva consulta". */}
            {pestaniaActiva === "historial" && (
              <PestaniaHistorialPaciente
                key={`historial-${version}`}
                paciente={paciente}
                rol={rol}
                perfilId={perfil?.id}
                onEditarVisita={(visita) => setConsultaAbierta({ visita })}
              />
            )}
          </Tabs>
        </PanelPacientes>

        {editando && (
          <ModalEdicionPaciente
            paciente={paciente}
            rol={rol}
            onClose={() => setEditando(false)}
            onGuardado={alGuardar}
          />
        )}

        {gestionandoCondiciones && (
          <ModalCondicionesPaciente
            pacienteId={paciente.id}
            rol={rol}
            onClose={() => setGestionandoCondiciones(false)}
            onCambio={refrescar}
          />
        )}

        {consultaAbierta && (
          <ModalConsulta
            paciente={paciente}
            visita={consultaAbierta.visita}
            rol={rol}
            perfilId={perfil?.id}
            onClose={() => setConsultaAbierta(null)}
            onGuardada={refrescar}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
