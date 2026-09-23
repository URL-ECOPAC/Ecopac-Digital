import { useNavigate } from "react-router-dom";
import {
  COLUMNAS_PACIENTE_CRONICO,
  FILTROS_PACIENTE_CRONICO,
  usePacientesCronicos,
} from "@ecopac/shared";
import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import SecondaryButton from "../components/SecondaryButton";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./pacientes.css";

export default function PacientesCronicosPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const {
    filas,
    total,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    recargar,
    catalogos,
  } = usePacientesCronicos({ rol });

  if (error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Pacientes crónicos"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" },
            ]}
          />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Pacientes crónicos"
          subtitle="Seguimiento de condiciones crónicas"
          actions={[{ label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" }]}
        />

        {/*  Filtros INTACTOS — sin meter en contenedor nuevo */}
        <FilterBar
          campos={FILTROS_PACIENTE_CRONICO}
          valores={filtros}
          onChange={setFiltro}
          catalogos={catalogos}
          onLimpiar={limpiarFiltros}
          hayFiltros={hayFiltros}
        />

        <p className="pac-rotulo mb-2">
          {total === 1 ? `${total} condición registrada` : `${total} condiciones registradas`}
        </p>

        <div className="ec-tabla">
          <DataList
            columnas={COLUMNAS_PACIENTE_CRONICO}
            datos={filas}
            cargando={cargando}
            catalogos={catalogos}
            onRowPress={(fila) => fila.pacienteId && navigate(`/pacientes/${fila.pacienteId}`)}
            vacio={
              hayFiltros ? (
                <EmptyState
                  message="Ningún paciente crónico coincide con los filtros."
                  actionLabel="Limpiar filtros"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState message="Todavía no hay condiciones crónicas registradas." />
              )
            }
          />
        </div>
      </div>
    </ScreenContainer>
  );
}