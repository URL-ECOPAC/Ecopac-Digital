import { StyleSheet, Text, View } from "react-native";
import { etiquetaDeRol } from "@ecopac/shared";
import { useSesionCompartida } from "../contexto/SesionProvider";

export default function UsuarioHeaderBar() {
  const { perfil } = useSesionCompartida();

  // issue #689: el placeholder "Administradora" para el rol, mientras el perfil todavia no
  // carga, era el mismo literal con mayuscula que rompio la bandeja de validacion (comparado,
  // ahi si, contra el enum real). Aqui no se compara nada -es solo texto- pero igual asumia un
  // rol que no es el que tiene la sesion. Vacio mientras carga; etiquetaDeRol() traduce el rol
  // real ya en minuscula ("administrador") a su etiqueta en pantalla.
  const nombre = perfil?.nombre || "";
  const rol = perfil?.rol ? etiquetaDeRol(perfil.rol) : "";

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
