import { StyleSheet, Text, View } from "react-native";
import { useSesionCompartida } from "../contexto/SesionProvider";

export default function UsuarioHeaderBar() {
  const { perfil } = useSesionCompartida();

  const nombre = perfil?.nombre || "Administradora...";
  const rol = perfil?.rol || "Administradora";

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.nombreText} numberOfLines={1}>
          {nombre}
        </Text>
        <Text style={styles.rolText} numberOfLines={1}>
          {rol}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  textContainer: {
    alignItems: "flex-end",
  },
  nombreText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
  },
  rolText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
});
