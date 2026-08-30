import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Encabezado de pantalla. Espejo de apps/web/src/components/PageHeader.jsx.
 *
 * Diferencia deliberada con la web, que el contrato admite: las acciones van en una fila
 * DEBAJO del titulo, no al lado. En un ancho de telefono no caben en la misma linea sin
 * partir el titulo.
 *
 * Cada accion es { label, onPress, variant }, con 'primary' por defecto.
 */
export default function PageHeader({ title, subtitle, actions = [] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{title}</Text>
      {subtitle ? <Text style={styles.subtitulo}>{subtitle}</Text> : null}

      {actions.length > 0 ? (
        <View style={styles.acciones}>
          {actions.map((accion) => {
            const Boton = accion.variant === "secondary" ? SecondaryButton : PrimaryButton;
            return (
              <Boton
                key={accion.label}
                title={accion.label}
                onPress={accion.onPress}
                style={styles.boton}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
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
    marginTop: spacing.md,
  },
  boton: {
    flexGrow: 1,
  },
});
