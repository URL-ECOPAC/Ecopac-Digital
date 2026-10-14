import { StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import Modal from "./Modal";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Aviso de cierre de sesion por inactividad, con cuenta regresiva (issue #840).
 *
 * Espejo de apps/web/src/components/AvisoDeInactividad.jsx, con las mismas props. El boton
 * "atras" de Android cuenta como seguir conectado: quien lo pulsa esta usando el telefono.
 */
export default function AvisoDeInactividad({ visible, segundosRestantes, onSeguir, onSalir }) {
  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = String(segundosRestantes % 60).padStart(2, "0");

  return (
    <Modal visible={visible} onClose={onSeguir} title="Tu sesión está por cerrarse">
      <Text style={styles.texto}>
        La app no se usó en una hora. Por seguridad, la sesión se cerrará sola para que nadie pueda
        ver expedientes desde este teléfono.
      </Text>
      <Text style={styles.cuenta} accessibilityRole="timer" accessibilityLiveRegion="polite">
        {minutos}:{segundos}
      </Text>
      <PrimaryButton title="Seguir conectado" onPress={onSeguir} style={styles.boton} />
      <SecondaryButton title="Cerrar sesión ahora" onPress={onSalir} style={styles.boton} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  texto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.md,
  },
  cuenta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
