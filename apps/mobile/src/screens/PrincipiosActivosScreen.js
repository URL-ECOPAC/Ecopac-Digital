import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  COLUMNAS_PRINCIPIO_ACTIVO,
  FILTROS_PRINCIPIOS_ACTIVOS,
  useCatalogoPrincipiosActivos,
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
import ModalPrincipioActivo from "./ModalPrincipioActivo";

export default function PrincipiosActivosScreen() {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;
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
    guardar,
    eliminar,
    permisos,
  } = useCatalogoPrincipiosActivos({ rol });

  if (!permisos.puedeVer) {
    return (
      <ScreenContainer>
        <ErrorState message="No tienes acceso al catálogo de principios activos." />
      </ScreenContainer>
    );
  }

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
        title="Principios activos"
        subtitle={total === 1 ? "1 principio activo" : `${total} principios activos`}
        accent={moduleAccents.inventario}
      />

      <FilterBar campos={FILTROS_PRINCIPIOS_ACTIVOS} valores={filtros} onChange={setFiltro} />

      <View style={estilos.lista}>
        <DataList
          columnas={COLUMNAS_PRINCIPIO_ACTIVO}
          datos={filas}
          cargando={cargando}
          onRowPress={
            permisos.puedeEditar ? (fila) => setModal({ principioActivo: fila }) : undefined
          }
          vacio={
            hayFiltros ? (
              <EmptyState
                message="Ningún principio activo coincide con la búsqueda."
                actionLabel="Limpiar búsqueda"
                onAction={limpiarFiltros}
              />
            ) : (
              <EmptyState message="Todavía no hay principios activos en el catálogo." />
            )
          }
        />
      </View>

      {permisos.puedeCrear ? (
        <PrimaryButton
          title="Nuevo principio activo"
          onPress={() => setModal({ principioActivo: null })}
          style={estilos.accion}
        />
      ) : null}

      {modal ? (
        <ModalPrincipioActivo
          visible
          principioActivo={modal.principioActivo}
          puedeEliminar={permisos.puedeEliminar}
          onClose={() => setModal(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
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
