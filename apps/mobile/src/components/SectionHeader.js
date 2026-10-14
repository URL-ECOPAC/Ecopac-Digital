import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Encabezado de una seccion dentro de una pantalla que ya tiene su PageHeader. Espejo de
 * apps/web/src/components/SectionHeader.jsx: un escalon por debajo del titulo de pantalla, con
 * el filete del color a la izquierda.
 *
 * Misma diferencia admitida que PageHeader: las acciones van debajo, no al lado.
 *
 * Cada accion es { label, onPress, variant }, con 'primary' por defecto.
 */
export default function SectionHeader({ title, subtitle, actions = [], accent, children }) {
  return (
    <View style={styles.container}>
      <View style={[styles.cabecera, accent ? { borderLeftColor: accent } : null]}>
        <Text style={styles.titulo}>{title}</Text>
        {subtitle ? <Text style={styles.subtitulo}>{subtitle}</Text> : null}
      </View>
      {children}

      {actions.length > 0 ? (
        <View style={styles.acciones}>
          {actions.map((accion) => {
            const Boton = accion.variant === "secondary" ? SecondaryButton : PrimaryButton;
            return <Boton key={accion.label} title={accion.label} onPress={accion.onPress} />;
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  cabecera: {
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  subtitulo: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  acciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
