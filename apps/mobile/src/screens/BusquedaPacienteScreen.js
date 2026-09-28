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
  DataList,
  EmptyState,
  ErrorState,
  FilterBar,
  MenuLateral,
  PageHeader,
  ScreenContainer,
  SecondaryButton,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

const GRUPOS_DE_PACIENTES = [
  {
    titulo: "Consultar",
    opciones: [
      {
        id: "cronicos",
        etiqueta: "Pacientes crónicos",
        descripcion: "Con una condición crónica activa",
        icono: "pulse-outline",
        ruta: ROUTES.PACIENTES_CRONICOS,
      },
      {
        id: "condiciones",
        etiqueta: "Catálogo de condiciones",
        descripcion: "Condiciones crónicas que se registran",
        icono: "list-outline",
        ruta: ROUTES.CATALOGO_CONDICIONES,
      },
      {
        id: "diagnosticos",
        etiqueta: "Catálogo de diagnósticos",
        descripcion: "Diagnósticos que se eligen en la consulta",
        icono: "medkit-outline",
        ruta: ROUTES.CATALOGO_DIAGNOSTICOS,
      },
    ],
  },
];

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
      <View style={styles.encabezado}>
        <View style={styles.encabezadoTitulo}>
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
        </View>
        {/* Crónicos, condiciones y diagnósticos eran una fila de botones sobre la lista: van en
            el menú lateral, como en Inventario (docs/DISENO-MOVIL.md, regla 3). */}
        <MenuLateral
          titulo="Pacientes"
          grupos={GRUPOS_DE_PACIENTES}
          onElegir={(opcion) => navigation.navigate(opcion.ruta)}
        />
      </View>

      {/* El buscador y los filtros en una fila: el placeholder sale del descriptor compartido
          (acepta nombre, número de ficha o DPI desde la #838). */}
      <FilterBar
        campos={FILTROS_PACIENTE}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
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
  // El boton del menu a la derecha del titulo, alineado con el.
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  encabezadoTitulo: {
    flex: 1,
  },
  pie: {
    marginTop: spacing.sm,
  },
});
