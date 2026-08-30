import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { PrimaryButton, ScreenContainer } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";

export default function AjustesScreen() {
  const { logout } = useSesionCompartida();

  return (
    <ScreenContainer>
      <View style={styles.contenido}>
        <Text style={styles.titulo}>Ajustes</Text>
        <PrimaryButton title="Cerrar sesión" onPress={logout} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: {
    gap: spacing.lg,
  },
  titulo: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
});
