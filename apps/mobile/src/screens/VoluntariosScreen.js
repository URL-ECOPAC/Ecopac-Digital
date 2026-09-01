import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { COLUMNAS_USUARIO_MOVIL, FILTROS_USUARIO, useUsuariosListado } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  DataList,
  EmptyState,
  ErrorState,
  FilterBar,
  ScreenContainer,
  SecondaryButton,
} from "../components";
import { ROUTES } from "../navigation/rutas";

// Listado de personal en movil (issue #272). Reusa useUsuariosListado() e FILTROS_USUARIO tal
// cual los entrego #105/#175 para la web: es el mismo hook, documentado como compartido por las
// dos plataformas (ver el comentario de useUsuariosListado.js). Solo la columna que dibuja cada
// tarjeta es propia de movil (COLUMNAS_USUARIO_MOVIL, packages/shared/usuarios/columnas.js).
//
// La paginacion es Anterior/Siguiente, no "cargar mas": useUsuariosListado() pagina por numero
// de pagina (issue #105, criterio 4), no con el patron hayMas/cargarMas de usePacientesListado.
export default function VoluntariosScreen() {
  const navigation = useNavigation();
  const {
    filas,
    filtros,
    setFiltro,
    cargando,
    error,
    recargar,
    pagina,
    paginas,
    hayPaginaAnterior,
    hayPaginaSiguiente,
    irAPaginaAnterior,
    irAPaginaSiguiente,
    catalogos,
  } = useUsuariosListado();

  if (error) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <FilterBar
        campos={FILTROS_USUARIO}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <DataList
        columnas={COLUMNAS_USUARIO_MOVIL}
        datos={filas}
        cargando={cargando}
        catalogos={catalogos}
        onRowPress={(fila) =>
          navigation.navigate(ROUTES.FICHA_VOLUNTARIO, { perfilId: fila.id })
        }
        vacio={<EmptyState message="No hay personal que coincida con los filtros." />}
      />

      {paginas > 1 && (
        <View style={styles.paginacion}>
          <SecondaryButton
            title="Anterior"
            onPress={irAPaginaAnterior}
            disabled={!hayPaginaAnterior}
          />
          <Text style={styles.paginaTexto}>
            Pagina {pagina} de {paginas}
          </Text>
          <SecondaryButton
            title="Siguiente"
            onPress={irAPaginaSiguiente}
            disabled={!hayPaginaSiguiente}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  paginacion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  paginaTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
