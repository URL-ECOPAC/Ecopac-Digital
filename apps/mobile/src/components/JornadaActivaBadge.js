import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";

/**
 * Nombre de la jornada activa, visible desde cualquier pantalla (issue #186, criterio 4).
 *
 * Espejo del patron de UsuarioActivo.js: lee su propio contexto en vez de recibir props, para
 * poder montarse igual en el headerRight de cualquier stack sin que AppNavigator tenga que
 * pasarle nada. No muestra nada si todavia no hay una jornada elegida (cero, varias sin decidir,
 * o mientras carga): la pantalla de seleccion ya explica el porque, este badge solo confirma
 * cuando SI hay una.
 */
export default function JornadaActivaBadge() {
  const { jornada } = useJornadaActivaCompartida();

  if (!jornada) return null;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta} numberOfLines={1} ellipsizeMode="tail">
        {jornada.nombre}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    maxWidth: 110,
    marginRight: spacing.sm,
    justifyContent: "center",
  },
  etiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
