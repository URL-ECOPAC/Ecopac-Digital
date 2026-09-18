import { View, Text, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useJornadasKanban } from "../../../../packages/shared/jornadas/useJornadasKanban";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { KanbanBoard } from "../components";
import { LoadingState, ErrorState } from "../components";

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
        <Text style={estilos.titulo}>📋 Tablero de Jornadas</Text>
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
    backgroundColor: "#f8fafc",
  },
  cabecera: {
    marginBottom: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  subtitulo: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
});