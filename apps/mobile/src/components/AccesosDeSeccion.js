import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;

export default function AccesosDeSeccion({ accesos = [], onAbrir }) {
  const visibles = accesos.filter((acceso) => acceso.visible !== false);
  if (visibles.length === 0) return null;

  return (
    <View style={estilos.fila}>
      {visibles.map((acceso) => (
        <Pressable
          key={acceso.id}
          onPress={() => onAbrir(acceso)}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.acceso, pressed && estilos.pulsado]}
        >
          <Text style={estilos.texto}>{acceso.etiqueta}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  acceso: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: MIN_TOUCH_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  pulsado: {
    opacity: 0.85,
  },
  texto: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
