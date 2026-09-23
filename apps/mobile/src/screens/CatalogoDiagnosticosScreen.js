import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  COLUMNAS_CATALOGO_DIAGNOSTICOS,
  FILTROS_CATALOGO_DIAGNOSTICOS,
  useCatalogoDiagnosticos,
} from "@ecopac/shared";
import { moduleAccents, spacing } from "@ecopac/ui-tokens";

import {
  DataList,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalDiagnostico from "./ModalDiagnostico";

export default function CatalogoDiagnosticosScreen() {
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null);

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
    permitido,
    puedeAdministrar,
    alternarActivo,
    catalogos,
  } = useCatalogoDiagnosticos({ rol });

  if (!permitido) {
    return (
      <ScreenContainer>
        <ErrorState message="No tienes acceso al catálogo de diagnósticos." />
      </ScreenContainer>
    );
  }

  if (error && filas.length === 0) {
    return (
      <ScreenContainer>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Diagnósticos"
        subtitle={total === 1 ? "1 diagnóstico" : `${total} diagnósticos`}
        accent={moduleAccents.pacientes}
      />

      <FilterBar
        campos={FILTROS_CATALOGO_DIAGNOSTICOS}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <View style={estilos.lista}>
        <DataList
          columnas={COLUMNAS_CATALOGO_DIAGNOSTICOS}
          datos={filas}
          cargando={cargando}
          catalogos={catalogos}
          onRowPress={puedeAdministrar ? (fila) => setModal({ diagnostico: fila }) : undefined}
          vacio={
            hayFiltros ? (
              <EmptyState
                message="Ningún diagnóstico coincide con los filtros."
                actionLabel="Limpiar filtros"
                onAction={limpiarFiltros}
              />
            ) : (
              <EmptyState message="Todavía no hay diagnósticos en el catálogo." />
            )
          }
        />
      </View>

      {puedeAdministrar ? (
        <PrimaryButton
          title="Nuevo diagnóstico"
          onPress={() => setModal({ diagnostico: null })}
          style={estilos.accion}
        />
      ) : null}

      {modal ? (
        <ModalDiagnostico
          visible
          diagnostico={modal.diagnostico}
          onClose={() => setModal(null)}
          onGuardado={recargar}
          onAlternarActivo={alternarActivo}
        />
      ) : null}
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  lista: {
    flex: 1,
  },
  accion: {
    marginTop: spacing.sm,
  },
});
