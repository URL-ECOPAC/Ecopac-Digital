import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import {
  COLUMNAS_PACIENTE_MOVIL,
  FILTROS_PACIENTE,
  puedeRegistrarPaciente,
  usePacientesListado,
} from "@ecopac/shared";
import { moduleAccents, spacing } from "@ecopac/ui-tokens";

import {
  AccesosDeSeccion,
  DataList,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  ScreenContainer,
  SecondaryButton,
  TextField,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

const FILTROS_SECUNDARIOS = FILTROS_PACIENTE.filter((filtro) => filtro.id !== "busqueda");

const ACCESOS_DE_PACIENTES = [
  { id: "cronicos", etiqueta: "Crónicos", ruta: ROUTES.PACIENTES_CRONICOS },
  { id: "condiciones", etiqueta: "Condiciones", ruta: ROUTES.CATALOGO_CONDICIONES },
  { id: "diagnosticos", etiqueta: "Diagnósticos", ruta: ROUTES.CATALOGO_DIAGNOSTICOS },
];
const CAMPO_DE_BUSQUEDA = FILTROS_PACIENTE.find((filtro) => filtro.id === "busqueda");

export default function BusquedaPacienteScreen() {
  const navigation = useNavigation();
  const { perfil } = useSesionCompartida();
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
    navigation.navigate(ROUTES.REGISTRO_PACIENTE, { termino: filtros.busqueda ?? "" });

  if (error) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} />
      </ScreenContainer>
    );
  }

  const hayFiltrosActivos = Object.values(filtros).some(
    (valor) => valor !== null && valor !== undefined && valor !== "",
  );

  return (
    <ScreenContainer scrollable={false}>
      {/* ISSUE #838: no habia por donde registrar un paciente desde movil. La unica puerta a
          RegistroPacienteScreen era el estado vacio de la lista, o sea que habia que buscar a
          alguien, no encontrarlo y solo entonces aparecia la opcion. Ahora es una accion de la
          cabecera, como en la web. */}
      <PageHeader
        title="Pacientes"
        subtitle="Busca un expediente o registra uno nuevo"
        accent={moduleAccents.pacientes}
        actions={
          puedeRegistrarPaciente(perfil?.rol)
            ? [{ label: "Nuevo paciente", onPress: irARegistro }]
            : []
        }
      />

      <TextField
        label={CAMPO_DE_BUSQUEDA?.label ?? "Buscar paciente"}
        // El placeholder sale del descriptor compartido y no de un texto propio: decia "Nombre o
        // número de ficha" cuando la busqueda tambien acepta DPI desde la #838.
        placeholder={CAMPO_DE_BUSQUEDA?.placeholder}
        value={filtros.busqueda ?? ""}
        onChangeText={(valor) => setFiltro("busqueda", valor)}
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

      <AccesosDeSeccion
        accesos={ACCESOS_DE_PACIENTES}
        onAbrir={(acceso) => navigation.navigate(acceso.ruta)}
      />

      <DataList
        columnas={COLUMNAS_PACIENTE_MOVIL}
        datos={filas}
        cargando={cargando}
        catalogos={catalogos}
        onRowPress={(fila) => navigation.navigate(ROUTES.FICHA_PACIENTE, { pacienteId: fila.id })}
        vacio={
          hayFiltrosActivos ? (
            <EmptyState
              message="Ningún paciente coincide. Podés registrarlo."
              actionLabel={puedeRegistrarPaciente(perfil?.rol) ? "Registrar paciente" : undefined}
              onAction={puedeRegistrarPaciente(perfil?.rol) ? irARegistro : undefined}
            />
          ) : (
            <EmptyState message="Busca un paciente por nombre, número de ficha o DPI." />
          )
        }
      />

      {hayMas && (
        <View style={styles.pie}>
          <SecondaryButton
            title={cargando ? "Cargando..." : "Cargar mas"}
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
