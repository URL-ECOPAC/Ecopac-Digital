import { StyleSheet, View } from "react-native";
import { COLUMNAS_PROYECTO, FILTROS_PROYECTO, useProyectosSociales } from "@ecopac/shared";
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

export default function ProyectosScreen() {
  const { rol } = useSesionCompartida();

  const {
    tieneAccesoLectura,
    cargando,
    error,
    proyectos,
    catalogos,
    recargar,
    filtrosState,
    setFiltrosState,
  } = useProyectosSociales({ usuarioRol: rol });

  if (!tieneAccesoLectura) {
    return (
      <ScreenContainer>
        <ErrorState message="No tienes acceso a los proyectos." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error.mensaje ?? String(error)} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Proyectos"
        subtitle={
          proyectos.length === 1
            ? "1 proyecto de tus jornadas"
            : `${proyectos.length} proyectos de tus jornadas`
        }
        accent={moduleAccents.proyectos}
      />

      <FilterBar
        campos={FILTROS_PROYECTO}
        valores={filtrosState}
        onChange={(id, valor) => setFiltrosState((previos) => ({ ...previos, [id]: valor ?? "" }))}
        catalogos={catalogos}
      />

      <View style={estilos.lista}>
        <DataList
          columnas={COLUMNAS_PROYECTO}
          datos={proyectos}
          cargando={cargando}
          catalogos={catalogos}
          vacio={
            <EmptyState message="No participas en ninguna jornada que pertenezca a un proyecto." />
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
