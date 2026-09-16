import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { COLUMNAS_COMUNIDAD, FILTROS_COMUNIDADES, useCatalogoComunidades } from "@ecopac/shared";
import { colors, typography } from "@ecopac/ui-tokens";

import { DataList, ErrorState, FilterBar, PageHeader, ScreenContainer } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalComunidad from "./ModalComunidad";

/**
 * Pantalla del catalogo de comunidades en movil (issue #756). Espejo de
 * apps/web/src/pages/CatalogoComunidadesPage.jsx: mismo hook, mismos descriptores, mismo
 * componente de mapa (WebView + Leaflet en vez de Leaflet directo sobre el DOM).
 */
export default function ComunidadesScreen() {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;
  const [modal, setModal] = useState(null); // null | { comunidad: object|null }

  const {
    comunidades,
    total,
    filtros,
    setFiltro,
    cargando,
    error,
    recargar,
    guardar,
    erroresForm,
    permisos,
    catalogos,
  } = useCatalogoComunidades({ rol });

  if (!permisos.puedeVer) {
    return (
      <ScreenContainer>
        <PageHeader title="Catalogo de comunidades" />
        <ErrorState message="No tienes acceso al catalogo de comunidades." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Catalogo de comunidades" />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  const acciones = permisos.puedeCrear
    ? [{ label: "Nueva comunidad", onPress: () => setModal({ comunidad: null }) }]
    : [];

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Catalogo de comunidades"
        subtitle="Comunidades del catalogo territorial, con su ubicacion en el mapa"
        actions={acciones}
      />

      <FilterBar
        campos={FILTROS_COMUNIDADES}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <Text style={styles.total}>{total === 1 ? "1 comunidad" : `${total} comunidades`}</Text>

      <DataList
        columnas={COLUMNAS_COMUNIDAD}
        datos={comunidades}
        cargando={cargando}
        catalogos={catalogos}
        onRowPress={permisos.puedeEditar ? (fila) => setModal({ comunidad: fila }) : undefined}
        vacio="Todavia no hay comunidades en el catalogo."
      />

      {modal && (
        <ModalComunidad
          visible
          comunidad={modal.comunidad}
          onClose={() => setModal(null)}
          onGuardar={guardar}
          erroresForm={erroresForm}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  total: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: 8,
  },
});
