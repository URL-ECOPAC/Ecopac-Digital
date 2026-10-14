import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Pestañas de navegacion DENTRO de una pantalla: no cambian de ruta.
 *
 * Espejo de apps/web/src/components/Tabs.jsx, que usa Nav de react-bootstrap. React Native
 * no tiene tabs nativos de layout, asi que son botones tipo pill. Van en un ScrollView
 * horizontal porque cuatro pestañas con etiquetas largas no caben en un telefono.
 *
 * No guarda estado propio, igual que en la web: quien lo usa controla cual esta activa.
 */
export default function Tabs({ tabs = [], activo, onChange, children }) {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fila}
      >
        {tabs.map((tab) => {
          const esActiva = tab.id === activo;
          return (
            <Pressable
              key={tab.id}
              style={({ pressed }) => [
                styles.pill,
                esActiva && styles.pillActiva,
                pressed && styles.pillPressed,
              ]}
              onPress={() => onChange?.(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: esActiva }}
            >
              <Text style={[styles.texto, esActiva && styles.textoActivo]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.contenido}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
  pill: {
    minHeight: MIN_TOUCH_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: MIN_TOUCH_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillPressed: { opacity: 0.7 },
  texto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  textoActivo: { color: colors.surface },
  contenido: { paddingTop: spacing.md },
});
