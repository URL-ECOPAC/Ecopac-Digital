import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, statusColors, typography } from "@ecopac/ui-tokens";

/**
 * Chip de estado. Espejo de apps/web/src/components/StatusChip.jsx.
 *
 * `status` debe ser exactamente un valor de un enum de la base de datos y se usa tal cual
 * como indice de statusColors. Sin tabla de traduccion propia a proposito: dos listas de
 * estados terminarian divergiendo de la migracion.
 *
 * En web el color sale de la variable --estado-* que publica theme.js; aqui se lee
 * statusColors directamente, que es la misma fuente.
 */
export default function StatusChip({ status, label }) {
  if (status === null || status === undefined || status === "") return null;

  // React Native tampoco pinta booleanos: la columna de estado de COLUMNAS_USUARIO lee el
  // campo activo, y sin convertirlo el chip saldria vacio.
  const texto = label ?? String(status);
  const fondo = statusColors[status] ?? colors.secondary;

  return (
    <View style={[styles.chip, { backgroundColor: fondo }]}>
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.md,
  },
  texto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.surface,
  },
});
