import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { ScreenContainer } from "../components";

export default function RestaurandoSesionScreen() {
  return (
    <ScreenContainer scrollable={false} contentContainerStyle={styles.contenido}>
      <View style={styles.estado}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.texto}>Restaurando sesión...</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: {
    alignItems: "center",
    justifyContent: "center",
  },
  estado: {
    alignItems: "center",
    gap: spacing.md,
  },
  texto: {
    color: colors.text,
    fontSize: typography.sizes.md,
  },
});
