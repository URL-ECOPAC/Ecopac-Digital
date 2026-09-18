import { View, Text, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useJornadasKanban } from "../../../../packages/shared/jornadas/useJornadasKanban";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { KanbanBoard } from "../components";
import { LoadingState, ErrorState } from "../components";
import { colors } from "../../../../packages/ui-tokens/index";

export default function KanbanJornadasScreen() {
  const navigation = useNavigation();
  const { rol } = useSesionCompartida();
  const { cargando, error, columnas, recargar, moverTarjeta } = useJornadasKanban({ rol });

  const verDetalle = (jornada) => {
    navigation.navigate("DetalleJornada", { jornadaId: jornada.id, titulo: jornada.nombre });
  };

  return (
    <ScrollView
      style={estilos.contenedor}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={recargar} />
      }
    >
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>Tablero de Jornadas</Text>
        <Text style={estilos.subtitulo}>Mueve las tarjetas para cambiar el estado</Text>
      </View>

      {cargando && <LoadingState mensaje="Cargando tablero..." />}
      {error && <ErrorState mensaje={error.mensaje} alReintentar={recargar} />}

      {!cargando && !error && (
        <KanbanBoard
          columnas={columnas}
          alMoverTarjeta={moverTarjeta}
          alPresionarTarjeta={verDetalle}
          tipoElemento="jornada"
        />
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background, //  Existe: #F7F8FA
  },
  cabecera: {
    marginBottom: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text, //  Existe: #2D2D2D
  },
  subtitulo: {
    fontSize: 13,
    color: colors.textMuted, //  Existe: #7A7A8A
    marginTop: 2,
  },
});