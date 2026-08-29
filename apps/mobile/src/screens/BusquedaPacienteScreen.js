import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { COLUMNAS_PACIENTE_MOVIL, FILTROS_PACIENTE, usePacientesListado } from '@ecopac/shared';
import { spacing } from '@ecopac/ui-tokens';

import {
  DataList,
  EmptyState,
  ErrorState,
  FilterBar,
  ScreenContainer,
  SecondaryButton,
  TextField,
} from '../components';
import { ROUTES } from '../navigation/rutas';

const FILTROS_SECUNDARIOS = FILTROS_PACIENTE.filter((filtro) => filtro.id !== 'busqueda');

export default function BusquedaPacienteScreen() {
  const navigation = useNavigation();
  const {
    filas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    hayMas,
    cargarMas,
    catalogos,
  } = usePacientesListado();

  const irARegistro = () =>
    navigation.navigate(ROUTES.REGISTRO_PACIENTE, { termino: filtros.busqueda ?? '' });

  if (error) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} />
      </ScreenContainer>
    );
  }

  const hayFiltrosActivos = Object.values(filtros).some(
    (valor) => valor !== null && valor !== undefined && valor !== '',
  );

  return (
    <ScreenContainer scrollable={false}>
      <TextField
        label="Buscar paciente"
        placeholder="Nombre o numero de ficha"
        value={filtros.busqueda ?? ''}
        onChangeText={(valor) => setFiltro('busqueda', valor)}
        autoCorrect={false}
        autoCapitalize="words"
        style={styles.busqueda}
      />

      <FilterBar
        campos={FILTROS_SECUNDARIOS}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <DataList
        columnas={COLUMNAS_PACIENTE_MOVIL}
        datos={filas}
        cargando={cargando}
        catalogos={catalogos}
        vacio={
          hayFiltrosActivos ? (
            <EmptyState
              message="Ningun paciente coincide. Podes registrarlo."
              actionLabel="Registrar paciente"
              onAction={irARegistro}
            />
          ) : (
            <EmptyState message="Busca un paciente por nombre o numero de ficha." />
          )
        }
      />

      {hayMas && (
        <View style={styles.pie}>
          <SecondaryButton
            title={cargando ? 'Cargando...' : 'Cargar mas'}
            onPress={cargarMas}
            disabled={cargando}
          />
        </View>
      )}

      {hayFiltrosActivos && filas.length > 0 && (
        <View style={styles.pie}>
          <SecondaryButton title="Limpiar busqueda" onPress={limpiarFiltros} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  busqueda: {
    marginBottom: spacing.sm,
  },
  pie: {
    marginTop: spacing.sm,
  },
});
