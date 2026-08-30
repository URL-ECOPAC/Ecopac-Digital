import { StyleSheet, Text, View } from "react-native";
import { etiquetaDeRol } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { useSesionCompartida } from "../contexto/SesionProvider";

export default function UsuarioActivo({ compacto = true }) {
  const { perfil } = useSesionCompartida();

  if (!perfil) return null;

  const nombre = `${perfil.nombres ?? ""} ${perfil.apellidos ?? ""}`.trim();
  const lineas = compacto ? 1 : undefined;

  return (
    <View style={compacto ? styles.compacto : styles.expandido}>
      <Text 
        style={styles.nombre} 
        numberOfLines={lineas}
        ellipsizeMode="tail"
      >
        {nombre || "Sesion activa"}
      </Text>
      <Text 
        style={styles.rol} 
        numberOfLines={lineas}
        ellipsizeMode="tail"
      >
        {etiquetaDeRol(perfil.rol)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compacto: {
    maxWidth: 110, // Reducido para evitar el desbordamiento en el header
    alignItems: "flex-end",
    marginRight: spacing.sm,
    justifyContent: "center",
  },
  expandido: {
    alignItems: "flex-start",
  },
  nombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  rol: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});