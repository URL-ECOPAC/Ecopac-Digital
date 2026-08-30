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
import { useSesionCompartida } from "../contexto/SesionProvider";

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
        <PageHeader
          title="Pacientes cronicos"
          actions={[
            { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
          ]}
        />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Pacientes cronicos"
        subtitle={total === 1 ? "1 condicion registrada" : `${total} condiciones registradas`}
        actions={[{ label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" }]}
      />

      <FilterBar
        campos={FILTROS_PACIENTE_CRONICO}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <DataList
        columnas={COLUMNAS_PACIENTE_CRONICO}
        datos={filas}
        cargando={cargando}
        catalogos={catalogos}
        onRowPress={(fila) => fila.pacienteId && navigate(`/pacientes/${fila.pacienteId}`)}
        vacio={
          hayFiltros ? (
            <EmptyState
              message="Ningun paciente cronico coincide con los filtros."
              actionLabel="Limpiar filtros"
              onAction={limpiarFiltros}
            />
          ) : (
            <EmptyState message="Todavia no hay condiciones cronicas registradas." />
          )
        }
      />
    </ScreenContainer>
  );
}
