import { StyleSheet, Text } from "react-native";
import { colors, typography } from "@ecopac/ui-tokens";

/**
 * El rotulo de un campo de formulario con su marca de obligatorio u opcional. Espejo de
 * apps/web/src/components/MarcaDeRequerido.jsx.
 *
 * `requerido` sale del descriptor (`campo.validacion.requerido`): true agrega un asterisco, false
 * agrega "(opcional)", y sin dato no agrega nada. Va dentro del <Text> del rotulo, con su estilo.
 */
export default function RotuloDeCampo({ texto, requerido, style }) {
  return (
    <Text style={style}>
      {texto}
      {requerido === true ? (
        <Text style={styles.requerido} accessibilityLabel="obligatorio">
          {" *"}
        </Text>
      ) : null}
      {requerido === false ? <Text style={styles.opcional}> (opcional)</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  requerido: {
    color: colors.danger,
    fontWeight: typography.weights.bold,
  },
  opcional: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
  },
});
