import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
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
 *
 * `accent` es el color del filete bajo el titulo, igual que en web: un valor de
 * `moduleAccents` o de `colors` de @ecopac/ui-tokens, nunca uno escrito a mano. Sin el, el
 * filete va en el color primario. `children` se dibuja bajo el filete.
 */
export default function PageHeader({ title, subtitle, actions = [], accent, children }) {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{title}</Text>
      {subtitle ? <Text style={styles.subtitulo}>{subtitle}</Text> : null}
      <View style={[styles.acento, accent ? { backgroundColor: accent } : null]} />
      {children}

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
  acento: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 3,
    marginTop: spacing.sm,
    width: 48,
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
