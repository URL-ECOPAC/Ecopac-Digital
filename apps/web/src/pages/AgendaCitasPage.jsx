import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  FILTROS_AGENDA_CITAS,
  OPCIONES_VISTA_AGENDA,
  useAgendaCitas,
  VISTAS_AGENDA,
} from "@ecopac/shared";

import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import SecondaryButton from "../components/SecondaryButton";
import { useSesionCompartida } from "../contexto/SesionProvider";
import CalendarioCitas from "./CalendarioCitas";
import "./citas.css";
import FlujoDeCita from "./FlujoDeCita";
import "./pacientes.css";

// La agenda de citas (issue #927): calendario de anio, mes y dia, filtros por jornada, clinica, area,
// profesional y estado, y "Mis citas" para el medico. Con una clinica filtrada, el dia dice cuantas
// salas le quedan en cada horario. Clic en una cita: su detalle y Atender, que abre la consulta de
// siempre con la cita. Clic en un horario vacio del dia: agendar ahi.
//
// Todo lo que decide es useAgendaCitas() en shared.
export default function AgendaCitasPage() {
  const navigate = useNavigate();
  const { rol, perfil } = useSesionCompartida();
  const agenda = useAgendaCitas({ rol, perfilId: perfil?.id ?? null });
  const [abierto, setAbierto] = useState(null);

  const volver = { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" };

  if (!agenda.permitido) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader title="Citas" actions={[volver]} />
          <ErrorState message="Tu rol no tiene acceso a la agenda de citas." />
        </div>
      </ScreenContainer>
    );
  }

  const acciones = [volver];
  if (agenda.puedeAgendar) {
    acciones.push({
      label: "Agendar cita",
      onClick: () =>
        setAbierto({
          tipo: "nueva",
          inicial: {
            fecha: agenda.vista === VISTAS_AGENDA.DIA ? agenda.fecha : undefined,
            jornadaId: agenda.filtros.jornadaId || undefined,
            clinicaId: agenda.filtros.clinicaId || undefined,
            areaId: agenda.filtros.areaId || undefined,
          },
        }),
    });
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Citas"
          subtitle="Agenda de las jornadas por clínica y área de atención"
          accent="var(--accent-pacientes)"
          actions={acciones}
        />

        <div className="pac-filtros">
          <FilterBar
            campos={FILTROS_AGENDA_CITAS}
            valores={agenda.filtros}
            onChange={agenda.setFiltro}
            catalogos={agenda.catalogos}
          />
          <div className="d-flex flex-wrap gap-2 mt-2">
            {agenda.puedeVerMisCitas && (
              <SecondaryButton
                title={agenda.misCitas ? "Ver todas las citas" : "Mis citas"}
                size="sm"
                variant="outline"
                className={agenda.misCitas ? "active" : ""}
                onClick={() => agenda.setMisCitas(!agenda.misCitas)}
                aria-pressed={agenda.misCitas}
              />
            )}
            {agenda.hayFiltros && (
              <SecondaryButton
                title="Limpiar filtros"
                size="sm"
                variant="neutra"
                onClick={agenda.limpiarFiltros}
              />
            )}
          </div>
        </div>

        {agenda.error && <ErrorState message={agenda.error.mensaje} onRetry={agenda.recargar} />}

        <div className="cit-barra">
          <div className="cit-navegacion">
            <SecondaryButton
              title=""
              aria-label="Anterior"
              size="sm"
              variant="neutra"
              icon={<ChevronLeft size={16} aria-hidden="true" />}
              onClick={agenda.anterior}
            />
            <SecondaryButton title="Hoy" size="sm" variant="neutra" onClick={agenda.irAHoy} />
            <SecondaryButton
              title=""
              aria-label="Siguiente"
              size="sm"
              variant="neutra"
              icon={<ChevronRight size={16} aria-hidden="true" />}
              onClick={agenda.siguiente}
            />
            <h2 className="cit-titulo">{agenda.titulo}</h2>
          </div>
          <div className="btn-group" role="group" aria-label="Vista del calendario">
            {OPCIONES_VISTA_AGENDA.map((opcion) => (
              <SecondaryButton
                key={opcion.value}
                title={opcion.label}
                size="sm"
                variant="outline"
                className={agenda.vista === opcion.value ? "active" : ""}
                aria-pressed={agenda.vista === opcion.value}
                onClick={() => agenda.setVista(opcion.value)}
              />
            ))}
          </div>
        </div>

        {agenda.vista === VISTAS_AGENDA.DIA && !agenda.clinicaFiltrada && (
          <p className="ec-campo-nota mt-0">
            Filtra por una clínica para ver cuántas salas quedan libres en cada horario.
          </p>
        )}

        {agenda.cargando && agenda.citas.length === 0 ? (
          <LoadingState message="Cargando la agenda..." />
        ) : (
          <CalendarioCitas
            agenda={agenda}
            onAbrirCita={(cita) => setAbierto({ tipo: "detalle", cita })}
            onAgendarEn={(hora) =>
              setAbierto({
                tipo: "nueva",
                inicial: {
                  fecha: agenda.fecha,
                  horaInicio: hora,
                  jornadaId: agenda.filtros.jornadaId || undefined,
                  clinicaId: agenda.filtros.clinicaId || undefined,
                  areaId: agenda.filtros.areaId || undefined,
                },
              })
            }
          />
        )}

        <FlujoDeCita
          abierto={abierto}
          setAbierto={setAbierto}
          rol={rol}
          perfilId={perfil?.id ?? null}
          onCambio={agenda.recargar}
          onVerPaciente={(cita) => navigate(`/pacientes/${cita.pacienteId}`)}
        />
      </div>
    </ScreenContainer>
  );
}
