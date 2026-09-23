import { StyleSheet, View } from "react-native";
import {
  COLUMNAS_PACIENTE_CRONICO,
  FILTROS_PACIENTE_CRONICO,
  usePacientesCronicos,
} from "@ecopac/shared";
import { moduleAccents } from "@ecopac/ui-tokens";

import {
  DataList,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  ScreenContainer,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

export default function PacientesCronicosScreen({ navigation }) {
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
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Pacientes crónicos"
        subtitle={total === 1 ? "1 condición registrada" : `${total} condiciones registradas`}
        accent={moduleAccents.pacientes}
      />

      <FilterBar
        campos={FILTROS_PACIENTE_CRONICO}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <View style={estilos.lista}>
        <DataList
          columnas={COLUMNAS_PACIENTE_CRONICO}
          datos={filas}
          cargando={cargando}
          catalogos={catalogos}
          onRowPress={(fila) =>
            fila.pacienteId &&
            navigation?.navigate(ROUTES.FICHA_PACIENTE, { pacienteId: fila.pacienteId })
          }
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
      </View>
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  lista: {
    flex: 1,
  },
});
